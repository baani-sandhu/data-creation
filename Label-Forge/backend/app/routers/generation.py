from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from app.database import jobs_col, chunks_col, results_col
from app.services.prompt_builder import (
    build_system_prompt,
    build_user_message,
    build_zero_shot_user_message,
)
from app.services.llm_service import extract_pairs
from app.auth import get_current_user, get_owned_job
from app.services.pair_hash import compute_pair_hash
from datetime import datetime, timezone
from app.limiter import limiter
import uuid
import asyncio

router = APIRouter(prefix="/jobs", tags=["generation"])

async def _get_chunk_metadata_by_id(chunk_ids: list[str]) -> dict[str, dict]:
    if not chunk_ids:
        return {}

    cursor = chunks_col.find({"_id": {"$in": chunk_ids}})
    chunks = await cursor.to_list(length=len(chunk_ids))
    return {chunk["_id"]: chunk for chunk in chunks}

def _normalize_job_example(input_text: str, output_pair: dict) -> dict:
    return {
        "input": input_text,
        "output": output_pair,
    }

async def run_generation_for_job(job_id: str, user_id: str):
    print(f"[generation] ENTER job_id={job_id} user_id={user_id}")
    job = await jobs_col.find_one({"_id": job_id, "user_id": user_id})
    if not job:
        raise HTTPException(404, "Job not found")

    examples = [{"pair": example} for example in job.get("examples", [])]
    has_examples = len(examples) > 0

    all_chunks_cursor = chunks_col.find(
        {"job_id": job_id}
    ).sort("chunk_index", 1)
    all_chunks = await all_chunks_cursor.to_list(length=500)
    chunks_to_process = all_chunks

    if not chunks_to_process:
        raise HTTPException(400, "No chunks left to process")

    system_prompt = build_system_prompt(
        job["task_prompt"],
        job["fields"],
        has_examples=has_examples,
    )

    existing_model_count = await results_col.count_documents(
        {"job_id": job_id, "source": "model"}
    )
    if existing_model_count == 0:
        run_number = 1
    else:
        max_run_doc = await results_col.find_one(
            {"job_id": job_id, "source": "model", "run_number": {"$exists": True}},
            sort=[("run_number", -1)]
        )
        max_run_number = max_run_doc.get("run_number") if max_run_doc else None
        run_number = (max_run_number + 1) if isinstance(max_run_number, int) else 2
    now = datetime.now(timezone.utc)
    all_results = []
    errors = []
    processed_chunks = 0
    total_chunks = len(chunks_to_process)

    lock_result = await jobs_col.update_one(
        {
            "_id": job_id,
            "user_id": user_id,
            "status": {"$nin": ["generating", "done"]},
        },
        {"$set": {
            "status": "generating",
            "processed_chunks": 0,
            "total_chunks": total_chunks,
            "updated_at": now,
        }}
    )
    if lock_result.matched_count == 0:
        current_job = await jobs_col.find_one({"_id": job_id, "user_id": user_id})
        current_status = current_job.get("status") if current_job else "unknown"
        print(f"[generation] SKIP job_id={job_id} status={current_status}")
        return {
            "job_id": job_id,
            "status": current_status,
            "total_pairs": 0,
            "high_confidence": 0,
            "low_confidence": 0,
            "chunks_processed": int((current_job or {}).get("processed_chunks") or 0),
            "errors": None,
            "skipped": True,
        }
    print(f"[generation] STARTED job_id={job_id} total_chunks={total_chunks}")

    semaphore = asyncio.Semaphore(3)
    progress_lock = asyncio.Lock()

    async def process_single_chunk(chunk: dict) -> tuple[list[dict], dict | None]:
        nonlocal processed_chunks
        async with semaphore:
            try:
                print(f"Processing chunk {chunk['chunk_index']} - {len(chunk['text'].split())} words")
                if has_examples:
                    user_message = build_user_message(chunk["text"], examples)
                else:
                    user_message = build_zero_shot_user_message(
                        chunk["text"],
                        job["fields"],
                    )
                pairs = await extract_pairs(system_prompt, user_message)
                print(f"Got {len(pairs)} pairs from chunk {chunk['chunk_index']}")

                result_docs = []
                for pair in pairs:
                    confidence = float(pair.pop("confidence", 0.0))
                    reasoning = pair.pop("reasoning", "")

                    # whatever is left in pair are the actual fields
                    result_docs.append({
                        "_id": str(uuid.uuid4()),
                        "job_id": job_id,
                        "chunk_id": chunk["_id"],
                        "pair": pair,
                        "pair_hash": compute_pair_hash(pair),
                        "confidence": confidence,
                        "reasoning": reasoning,
                        "source": "model",
                        "human_reviewed": False,
                        "approved": confidence >= job["confidence_threshold"],
                        "discarded": False,
                        "used_as_example": False,
                        "run_number": run_number,
                        "created_at": now,
                    })

                return result_docs, None
            except Exception as e:
                print(f"ERROR on chunk {chunk['chunk_index']}: {str(e)}")
                return [], {
                    "chunk_id": chunk["_id"],
                    "chunk_index": chunk["chunk_index"],
                    "error": str(e),
                }
            finally:
                async with progress_lock:
                    processed_chunks += 1
                    await jobs_col.update_one(
                        {"_id": job_id, "user_id": user_id},
                        {"$set": {
                            "processed_chunks": processed_chunks,
                            "total_chunks": total_chunks,
                            "updated_at": datetime.now(timezone.utc),
                        }}
                    )

    chunk_results = await asyncio.gather(
        *[process_single_chunk(chunk) for chunk in chunks_to_process]
    )

    for result_docs, error in chunk_results:
        all_results.extend(result_docs)
        if error:
            errors.append(error)

    await results_col.delete_many(
        {"job_id": job_id, "source": "model", "approved": False}
    )
    if all_results:
        await results_col.insert_many(all_results)

    high_conf = [r for r in all_results if r["approved"]]
    low_conf = [r for r in all_results if not r["approved"]]

    await jobs_col.update_one(
        {"_id": job_id, "user_id": user_id},
        {"$set": {
            "status": "review",
            "processed_chunks": processed_chunks,
            "total_chunks": total_chunks,
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    print(f"[generation] DONE job_id={job_id} status=review total_pairs={len(all_results)}")

    return {
        "job_id": job_id,
        "status": "review",
        "total_pairs": len(all_results),
        "high_confidence": len(high_conf),
        "low_confidence": len(low_conf),
        "chunks_processed": len(chunks_to_process),
        "run_number": run_number,
        "errors": errors if errors else None,
    }

@router.post("/{job_id}/generate")
@limiter.limit("5/minute")
async def generate(request: Request, job_id: str, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)
    return await run_generation_for_job(job_id, user["uid"])

@router.get("/{job_id}/results")
async def get_results(
    job_id: str,
    include_discarded: bool = False,
    approved: Optional[bool] = None,
    source: Optional[str] = None,
    augmentation_job_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    await get_owned_job(job_id, user)

    query = {"job_id": job_id}
    if not include_discarded:
        query["discarded"] = {"$ne": True}
    if approved is not None:
        query["approved"] = approved
    if source:
        query["source"] = source
    if augmentation_job_id:
        query["augmentation_job_id"] = augmentation_job_id

    cursor = results_col.find(query)
    results = await cursor.to_list(length=None)
    chunk_map = await _get_chunk_metadata_by_id([r["chunk_id"] for r in results])
    results.sort(key=lambda r: chunk_map.get(r["chunk_id"], {}).get("chunk_index", 0))
    for r in results:
        r["_id"] = str(r["_id"])
        chunk = chunk_map.get(r["chunk_id"])
        if chunk is not None:
            r["chunk_index"] = chunk.get("chunk_index")
            if "source_filename" in chunk:
                r["source_filename"] = chunk.get("source_filename")

    return {
        "job_id": job_id,
        "total": len(results),
        "results": results,
    }

@router.get("/{job_id}/results/stats")
async def get_results_stats(job_id: str, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)

    total = await results_col.count_documents(
        {"job_id": job_id, "discarded": {"$ne": True}}
    )
    approved = await results_col.count_documents(
        {"job_id": job_id, "approved": True}
    )
    pending = await results_col.count_documents(
        {"job_id": job_id, "approved": False, "discarded": {"$ne": True}}
    )
    discarded = await results_col.count_documents(
        {"job_id": job_id, "discarded": True}
    )
    human_reviewed = await results_col.count_documents(
        {"job_id": job_id, "human_reviewed": True}
    )

    run_numbers = await results_col.distinct("run_number", {"job_id": job_id})
    by_run = {}
    for run_number in run_numbers:
        if run_number is None:
            continue
        by_run[str(run_number)] = await results_col.count_documents(
            {"job_id": job_id, "run_number": run_number}
        )

    return {
        "job_id": job_id,
        "total": total,
        "approved": approved,
        "pending": pending,
        "discarded": discarded,
        "human_reviewed": human_reviewed,
        "by_run": by_run,
    }

class UpdateResultBody(BaseModel):
    pair: Optional[dict] = None
    approved: Optional[bool] = None
    discarded: Optional[bool] = None
    human_reviewed: Optional[bool] = None

@router.patch("/{job_id}/results/{result_id}")
async def update_result(job_id: str, result_id: str, body: UpdateResultBody, user: dict = Depends(get_current_user)):
    """
    Used in the review screen - human can approve, discard, or edit a low confidence pair.
    """
    job = await get_owned_job(job_id, user)
    existing = await results_col.find_one({"_id": result_id, "job_id": job_id})
    if not existing:
        raise HTTPException(404, "Result not found")

    update_data = {}

    if body.pair is not None:
        job_fields = set(job.get("fields", []))
        pair_fields = set(body.pair.keys())
        if pair_fields != job_fields:
            raise HTTPException(400, "Pair fields must exactly match job fields")
        update_data["pair"] = body.pair
        update_data["pair_hash"] = compute_pair_hash(body.pair)

    if body.approved is not None:
        update_data["approved"] = body.approved
    if body.discarded is not None:
        update_data["discarded"] = body.discarded
        if body.discarded is True:
            update_data["approved"] = False

    update_data["human_reviewed"] = True
    update_data["updated_at"] = datetime.now(timezone.utc)

    await results_col.update_one(
        {"_id": result_id, "job_id": job_id},
        {"$set": update_data}
    )

    updated = await results_col.find_one({"_id": result_id, "job_id": job_id})
    if not updated:
        raise HTTPException(404, "Result not found")
    updated["_id"] = str(updated["_id"])
    chunk_map = await _get_chunk_metadata_by_id([updated["chunk_id"]])
    chunk = chunk_map.get(updated["chunk_id"])
    if chunk is not None:
        updated["chunk_index"] = chunk.get("chunk_index")
        if "source_filename" in chunk:
            updated["source_filename"] = chunk.get("source_filename")
    return updated

@router.post("/{job_id}/results/{result_id}/add-example")
async def add_example(job_id: str, result_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    result = await results_col.find_one({"_id": result_id, "job_id": job_id})
    if not result:
        raise HTTPException(404, "Result not found")

    if result.get("discarded") is True:
        raise HTTPException(400, "Result is discarded")

    chunk = await chunks_col.find_one({"_id": result["chunk_id"], "job_id": job_id})
    if not chunk:
        raise HTTPException(404, "Chunk not found")

    normalized_example = _normalize_job_example(chunk["text"], result["pair"])
    examples = list(job.get("examples", []))
    for existing_example in examples:
        if (
            existing_example.get("input") == normalized_example["input"]
            and existing_example.get("output") == normalized_example["output"]
        ):
            raise HTTPException(400, "Already added as example")

    now = datetime.now(timezone.utc)
    examples.append(normalized_example)
    await jobs_col.update_one(
        {"_id": job_id, "user_id": user["uid"]},
        {"$set": {"examples": examples, "updated_at": now}}
    )

    await results_col.update_one(
        {"_id": result_id, "job_id": job_id},
        {"$set": {"used_as_example": True}}
    )

    return {"added": True, "example_id": str(len(examples) - 1)}
