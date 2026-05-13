import uuid
import logging
from datetime import datetime, timezone

from app.database import jobs_col, results_col
from app.services.llm_service import extract_pairs
from app.services.pair_hash import compute_pair_hash
from app.services.prompt_builder import (
    build_mode2_generation_system_prompt,
    build_mode2_generation_user_message,
)

logger = logging.getLogger(__name__)


async def run_mode2_generation_for_chunk(
    *,
    job_id: str,
    chunk: dict,
    existing_approved_pairs: list[dict],
    quota: int,
    augmentation_run_id: str,
    augmentation_cycle: int,
) -> int:
    print(
        f"[mode2] entered run_mode2_generation_for_chunk job_id={job_id} chunk_id={chunk.get('_id')} quota={quota}"
    )
    try:
        job = await jobs_col.find_one({"_id": job_id})
        if not job:
            raise ValueError(f"Job not found: {job_id}")

        fields = job.get("fields", [])
        if not fields:
            return 0

        system_prompt = build_mode2_generation_system_prompt(job["task_prompt"], fields)
        inserted_count = 0

        negative_context = [pair for pair in existing_approved_pairs if isinstance(pair, dict)]
        print(
            "[mode2] context: "
            f"negative_context_count={len(negative_context)} "
            f"requested_count={quota}"
        )
        user_message = build_mode2_generation_user_message(
            chunk_text=chunk.get("text", ""),
            fields=fields,
            existing_pairs=negative_context,
            requested_count=quota,
        )

        generated = await extract_pairs(system_prompt, user_message)
        if not generated:
            print("[mode2] gemini result: raw_len=0 dedup_pass=0 threshold_pass=0 docs_to_insert_len=0")
            return 0

        docs_to_insert = []
        now = datetime.now(timezone.utc)
        dedup_pass_count = 0
        threshold_pass_count = 0

        for raw_pair in generated:
            if inserted_count + len(docs_to_insert) >= quota:
                break
            if not isinstance(raw_pair, dict):
                continue

            confidence_raw = raw_pair.get("confidence", 0.0)
            reasoning = str(raw_pair.get("reasoning", ""))
            pair_values = {field: raw_pair.get(field, "") for field in fields}
            if any(str(pair_values.get(field, "")).strip() == "" for field in fields):
                continue

            pair_hash = compute_pair_hash(pair_values)
            existing = await results_col.find_one({"job_id": job_id, "pair_hash": pair_hash}, projection={"_id": 1})
            if existing:
                continue
            dedup_pass_count += 1

            try:
                confidence = float(confidence_raw)
            except (TypeError, ValueError):
                confidence = 0.0
            if confidence >= float(job.get("confidence_threshold", 0.75)):
                threshold_pass_count += 1

            doc = {
                "_id": str(uuid.uuid4()),
                "job_id": job_id,
                "chunk_id": chunk["_id"],
                "pair": pair_values,
                "pair_hash": pair_hash,
                "confidence": confidence,
                "reasoning": reasoning,
                "source": "augmented",
                "human_reviewed": False,
                "approved": confidence >= float(job.get("confidence_threshold", 0.75)),
                "discarded": False,
                "used_as_example": False,
                "created_at": now,
                "is_augmented": True,
                "augmentation_source": "generation",
                "parent_pair_id": None,
                "original_result_id": None,
                "augmentation_cycle": augmentation_cycle,
                "augmentation_run_id": augmentation_run_id,
            }
            docs_to_insert.append(doc)

        print(
            "[mode2] gemini result: "
            f"raw_len={len(generated)} "
            f"dedup_pass={dedup_pass_count} "
            f"threshold_pass={threshold_pass_count} "
            f"docs_to_insert_len={len(docs_to_insert)}"
        )

        if not docs_to_insert:
            return 0

        await results_col.insert_many(docs_to_insert)
        inserted_count += len(docs_to_insert)

        return inserted_count
    except Exception:
        print(f"[mode2] exception job_id={job_id} chunk_id={chunk.get('_id')}")
        logger.exception("mode2 run failed for job_id=%s chunk_id=%s", job_id, chunk.get("_id"))
        return 0
