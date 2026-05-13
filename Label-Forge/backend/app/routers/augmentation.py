import asyncio
import json
import math
import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user, get_owned_job
from app.database import augmentation_runs_col, chunks_col, results_col
from app.services.llm_service import extract_pairs
from app.services.noise_detector import calculate_noise_score
from app.services.pair_hash import compute_pair_hash
from app.services.prompt_builder import (
    build_generation_augmentation_prompt,
    build_paraphrase_prompt,
)

router = APIRouter(tags=["augmentation"])


class ParaphraseAugmentBody(BaseModel):
    target_size: int = Field(..., ge=0)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_aug_doc(
    *,
    job_id: str,
    pair: dict,
    pair_hash: str,
    augmentation_job_id: str,
    augmentation_mode: str,
    chunk_id: str | None = None,
    original_result_id: str | None = None,
) -> dict:
    return {
        "_id": str(uuid.uuid4()),
        "job_id": job_id,
        "chunk_id": chunk_id,
        "pair": pair,
        "pair_hash": pair_hash,
        "confidence": 0.0,
        "reasoning": "Augmented pair",
        "source": "augmented",
        "human_reviewed": False,
        "approved": False,
        "discarded": False,
        "used_as_example": False,
        "created_at": _utcnow(),
        "is_augmented": True,
        "augmentation_source": augmentation_mode,
        "augmentation_mode": augmentation_mode,
        "augmentation_job_id": augmentation_job_id,
        "original_result_id": original_result_id,
    }


def _noise_status_from_score(score: float) -> str:
    if score > 0.30:
        return "rollback_recommended"
    if score >= 0.20:
        return "warning"
    return "clean"


async def _run_paraphrase_augmentation(job_id: str, augmentation_job_id: str, target_size: int) -> None:
    job = await augmentation_runs_col.find_one({"augmentation_job_id": augmentation_job_id, "job_id": job_id})
    if not job:
        return

    source_job = await get_owned_job(job_id, {"uid": job["user_id"]})
    fields = source_job.get("fields", [])
    if not fields:
        await augmentation_runs_col.update_one(
            {"augmentation_job_id": augmentation_job_id},
            {"$set": {"status": "failed", "message": "No fields configured.", "completed_at": _utcnow()}},
        )
        return

    approved_docs = await results_col.find(
        {"job_id": job_id, "approved": True, "discarded": {"$ne": True}}
    ).to_list(length=None)
    current_count = len(approved_docs)
    gap = target_size - current_count
    if gap <= 0:
        await augmentation_runs_col.update_one(
            {"augmentation_job_id": augmentation_job_id},
            {
                "$set": {
                    "status": "completed",
                    "pairs_added": 0,
                    "noise_report": {
                        "noise_score": 0.0,
                        "noise_percentage": 0.0,
                        "status": "clean",
                        "message": "Target already reached.",
                    },
                    "completed_at": _utcnow(),
                }
            },
        )
        return

    variants_per_pair = int(math.ceil(gap / max(current_count, 1)))
    batch_size = 50
    generated_docs: list[dict] = []
    completed_batches = 0

    for start in range(0, len(approved_docs), batch_size):
        batch = approved_docs[start : start + batch_size]
        batch_pairs = [{field: doc.get("pair", {}).get(field, "") for field in fields} for doc in batch]
        prompt = build_paraphrase_prompt(batch_pairs, variants_per_pair, fields)
        response = await extract_pairs("", prompt)

        for item in response:
            if not isinstance(item, dict):
                continue
            idx = item.get("original_index")
            variants = item.get("variants")
            if not isinstance(idx, int) or not isinstance(variants, list):
                continue
            if idx < 0 or idx >= len(batch):
                continue
            original_doc = batch[idx]
            for variant in variants:
                if not isinstance(variant, dict):
                    continue
                pair = {field: str(variant.get(field, "")).strip() for field in fields}
                if any(pair[field] == "" for field in fields):
                    continue
                pair_hash = compute_pair_hash(pair)
                existing = await results_col.find_one(
                    {"job_id": job_id, "pair_hash": pair_hash}, projection={"_id": 1}
                )
                if existing:
                    continue
                generated_docs.append(
                    _build_aug_doc(
                        job_id=job_id,
                        pair=pair,
                        pair_hash=pair_hash,
                        augmentation_job_id=augmentation_job_id,
                        augmentation_mode="paraphrase",
                        chunk_id=original_doc.get("chunk_id"),
                        original_result_id=str(original_doc.get("_id")),
                    )
                )
                if len(generated_docs) >= gap:
                    break
            if len(generated_docs) >= gap:
                break
        completed_batches += 1
        await augmentation_runs_col.update_one(
            {"augmentation_job_id": augmentation_job_id},
            {"$set": {"completed_batches": completed_batches}},
        )
        if len(generated_docs) >= gap:
            break

    docs_to_insert = generated_docs[:gap]
    if docs_to_insert:
        await results_col.insert_many(docs_to_insert)

    aug_pairs = [doc["pair"] for doc in docs_to_insert if isinstance(doc.get("pair"), dict)]
    original_ids = [doc.get("original_result_id") for doc in docs_to_insert if doc.get("original_result_id")]
    originals = await results_col.find({"_id": {"$in": original_ids}}).to_list(length=None) if original_ids else []
    original_lookup = {doc["_id"]: doc.get("pair", {}) for doc in originals}
    orig_pairs = [
        original_lookup.get(doc.get("original_result_id"))
        for doc in docs_to_insert
        if original_lookup.get(doc.get("original_result_id")) is not None
    ]
    aug_pairs_matched = [doc["pair"] for doc in docs_to_insert if doc.get("original_result_id") in original_lookup]
    noise_result = await asyncio.get_running_loop().run_in_executor(
        None,
        calculate_noise_score,
        aug_pairs_matched,
        orig_pairs,
    )

    await augmentation_runs_col.update_one(
        {"augmentation_job_id": augmentation_job_id},
        {
            "$set": {
                "status": "completed",
                "pairs_added": len(docs_to_insert),
                "noise_report": noise_result,
                "completed_at": _utcnow(),
            }
        },
    )


async def _faithfulness_check(chunk_text: str, pair: dict) -> dict:
    prompt = (
        "Given this source text:\n"
        f"{chunk_text}\n\n"
        "Is this training pair factually supported by the source text?\n"
        f"Pair: {json.dumps(pair, ensure_ascii=False)}\n\n"
        "Answer ONLY as JSON array with one object:\n"
        "[{\"faithful\": true, \"score\": 0.0}]"
    )
    parsed = await extract_pairs("", prompt)
    if parsed and isinstance(parsed[0], dict):
        faithful = bool(parsed[0].get("faithful", False))
        try:
            score = float(parsed[0].get("score", 0.0))
        except (TypeError, ValueError):
            score = 0.0
        return {"faithful": faithful, "score": score}
    return {"faithful": False, "score": 0.0}


async def _run_generation_augmentation(job_id: str, augmentation_job_id: str) -> None:
    job = await augmentation_runs_col.find_one({"augmentation_job_id": augmentation_job_id, "job_id": job_id})
    if not job:
        return

    source_job = await get_owned_job(job_id, {"uid": job["user_id"]})
    fields = source_job.get("fields", [])
    if not fields:
        await augmentation_runs_col.update_one(
            {"augmentation_job_id": augmentation_job_id},
            {"$set": {"status": "failed", "message": "No fields configured.", "completed_at": _utcnow()}},
        )
        return

    chunks = await chunks_col.find({"job_id": job_id}).sort("chunk_index", 1).to_list(length=None)
    docs_to_insert: list[dict] = []
    per_chunk_pairs: list[tuple[str, dict]] = []
    completed_batches = 0

    for chunk in chunks:
        chunk_id = chunk.get("_id")
        chunk_text = chunk.get("text", "")
        existing_docs = await results_col.find(
            {"job_id": job_id, "chunk_id": chunk_id, "source": {"$ne": "augmented"}}
        ).to_list(length=None)
        existing_pairs = [doc.get("pair", {}) for doc in existing_docs if isinstance(doc.get("pair"), dict)]
        prompt = build_generation_augmentation_prompt(chunk_text, existing_pairs, fields)
        generated_pairs = await extract_pairs("", prompt)

        for raw in generated_pairs:
            if not isinstance(raw, dict):
                continue
            pair = {field: str(raw.get(field, "")).strip() for field in fields}
            if any(pair[field] == "" for field in fields):
                continue
            pair_hash = compute_pair_hash(pair)
            existing = await results_col.find_one(
                {"job_id": job_id, "pair_hash": pair_hash}, projection={"_id": 1}
            )
            if existing:
                continue
            docs_to_insert.append(
                _build_aug_doc(
                    job_id=job_id,
                    pair=pair,
                    pair_hash=pair_hash,
                    augmentation_job_id=augmentation_job_id,
                    augmentation_mode="generate",
                    chunk_id=chunk_id,
                    original_result_id=None,
                )
            )
            per_chunk_pairs.append((chunk_text, pair))

        completed_batches += 1
        await augmentation_runs_col.update_one(
            {"augmentation_job_id": augmentation_job_id},
            {"$set": {"completed_batches": completed_batches}},
        )

    if docs_to_insert:
        await results_col.insert_many(docs_to_insert)

    total_generated = len(docs_to_insert)
    sample_size = max(1, int(math.ceil(total_generated * 0.10))) if total_generated else 0
    sampled = random.sample(per_chunk_pairs, sample_size) if sample_size else []
    hallucinated_count = 0
    for chunk_text, pair in sampled:
        verdict = await _faithfulness_check(chunk_text, pair)
        if float(verdict.get("score", 0.0)) < 0.7:
            hallucinated_count += 1

    hallucination_rate = (hallucinated_count / sample_size) if sample_size else 0.0
    noise_percentage = round(hallucination_rate * 100, 2)
    status = _noise_status_from_score(hallucination_rate)
    if status == "rollback_recommended":
        message = f"Noise level is high ({noise_percentage}%). Consider rollback."
    elif status == "warning":
        message = f"Noise level is moderate ({noise_percentage}%). Review generated pairs carefully."
    else:
        message = f"Noise level is acceptable ({noise_percentage}%)."

    noise_report = {
        "noise_score": round(float(hallucination_rate), 4),
        "noise_percentage": noise_percentage,
        "hallucinated_count": hallucinated_count,
        "total_sampled": sample_size,
        "total_generated": total_generated,
        "status": status,
        "message": message,
    }

    await augmentation_runs_col.update_one(
        {"augmentation_job_id": augmentation_job_id},
        {
            "$set": {
                "status": "completed",
                "pairs_added": total_generated,
                "noise_report": noise_report,
                "completed_at": _utcnow(),
            }
        },
    )


@router.post("/jobs/{job_id}/augment/paraphrase")
async def start_paraphrase_augmentation(
    job_id: str,
    body: ParaphraseAugmentBody,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    await get_owned_job(job_id, user)
    augmentation_job_id = str(uuid.uuid4())
    await augmentation_runs_col.insert_one(
        {
            "_id": augmentation_job_id,
            "augmentation_run_id": augmentation_job_id,
            "augmentation_job_id": augmentation_job_id,
            "job_id": job_id,
            "user_id": user["uid"],
            "mode": "paraphrase",
            "target_size": int(body.target_size),
            "status": "pending",
            "pairs_added": 0,
            "completed_batches": 0,
            "noise_report": None,
            "created_at": _utcnow(),
            "completed_at": None,
        }
    )
    background_tasks.add_task(_run_paraphrase_augmentation, job_id, augmentation_job_id, int(body.target_size))
    return {"augmentation_job_id": augmentation_job_id, "status": "pending"}


@router.post("/jobs/{job_id}/augment/generate")
async def start_generation_augmentation(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    await get_owned_job(job_id, user)
    augmentation_job_id = str(uuid.uuid4())
    await augmentation_runs_col.insert_one(
        {
            "_id": augmentation_job_id,
            "augmentation_run_id": augmentation_job_id,
            "augmentation_job_id": augmentation_job_id,
            "job_id": job_id,
            "user_id": user["uid"],
            "mode": "generate",
            "status": "pending",
            "pairs_added": 0,
            "completed_batches": 0,
            "noise_report": None,
            "created_at": _utcnow(),
            "completed_at": None,
        }
    )
    background_tasks.add_task(_run_generation_augmentation, job_id, augmentation_job_id)
    return {"augmentation_job_id": augmentation_job_id, "status": "pending"}


@router.get("/jobs/{job_id}/augment/history")
async def get_augmentation_history(job_id: str, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)
    docs = await augmentation_runs_col.find({"job_id": job_id}).sort("created_at", -1).to_list(length=None)
    return [
        {
            "augmentation_job_id": doc["augmentation_job_id"],
            "mode": doc.get("mode"),
            "status": doc.get("status"),
            "pairs_added": int(doc.get("pairs_added", 0)),
            "noise_report": doc.get("noise_report"),
            "created_at": doc.get("created_at"),
            "can_rollback": doc.get("status") == "completed",
        }
        for doc in docs
    ]


@router.get("/jobs/{job_id}/augment/{augmentation_job_id}")
async def get_augmentation_job_status(
    job_id: str, augmentation_job_id: str, user: dict = Depends(get_current_user)
):
    await get_owned_job(job_id, user)
    doc = await augmentation_runs_col.find_one({"augmentation_job_id": augmentation_job_id, "job_id": job_id})
    if not doc:
        raise HTTPException(404, "Augmentation job not found")
    return {
        "augmentation_job_id": doc["augmentation_job_id"],
        "mode": doc.get("mode"),
        "status": doc.get("status"),
        "pairs_added": int(doc.get("pairs_added", 0)),
        "completed_batches": int(doc.get("completed_batches", 0)),
        "noise_report": doc.get("noise_report"),
        "created_at": doc.get("created_at"),
        "completed_at": doc.get("completed_at"),
    }


@router.delete("/jobs/{job_id}/augment/{augmentation_job_id}")
async def rollback_augmentation_job(
    job_id: str, augmentation_job_id: str, user: dict = Depends(get_current_user)
):
    await get_owned_job(job_id, user)
    job_doc = await augmentation_runs_col.find_one({"augmentation_job_id": augmentation_job_id, "job_id": job_id})
    if not job_doc:
        raise HTTPException(404, "Augmentation job not found")
    if job_doc.get("status") == "rolled_back":
        return {"status": "rolled_back", "deleted_pairs": 0}

    deleted = await results_col.delete_many(
        {
            "job_id": job_id,
            "augmentation_job_id": augmentation_job_id,
            "source": "augmented",
        }
    )
    await augmentation_runs_col.update_one(
        {"augmentation_job_id": augmentation_job_id, "job_id": job_id},
        {"$set": {"status": "rolled_back", "rolled_back_at": _utcnow(), "rollback_deleted_pairs": int(deleted.deleted_count)}},
    )
    return {"status": "rolled_back", "deleted_pairs": int(deleted.deleted_count)}
