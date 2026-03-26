from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.database import jobs_col, chunks_col, examples_col, results_col
from app.services.prompt_builder import build_system_prompt, build_user_message
from app.services.llm_service import extract_pairs
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/jobs", tags=["generation"])


@router.post("/{job_id}/generate")
async def generate(job_id: str):
    # 1. load job
    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")

    # 2. load human examples
    examples_cursor = examples_col.find({"job_id": job_id}).sort("created_at", 1)
    examples = await examples_cursor.to_list(length=500)
    if len(examples) < 2:
        raise HTTPException(400, "At least 2 labeled examples required before generating")

    # 3. load all chunks except the ones already manually labeled
    labeled_chunk_ids = set(e["chunk_id"] for e in examples)
    all_chunks_cursor = chunks_col.find(
        {"job_id": job_id}
    ).sort("chunk_index", 1)
    all_chunks = await all_chunks_cursor.to_list(length=500)
    # Also exclude chunks that already have approved results
    approved_results_cursor = results_col.find(
        {"job_id": job_id, "approved": True}
    )
    approved_results = await approved_results_cursor.to_list(length=2000)
    approved_chunk_ids = set(r["chunk_id"] for r in approved_results)

    chunks_to_process = [
        c for c in all_chunks
        if c["_id"] not in labeled_chunk_ids and c["_id"] not in approved_chunk_ids
    ]

    if not chunks_to_process:
        raise HTTPException(400, "No chunks left to process")

    # 4. build prompt once (reused for every chunk)
    system_prompt = build_system_prompt(job["task_prompt"], job["fields"])

    # 5. process each chunk
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

    await jobs_col.update_one(
        {"_id": job_id},
        {"$set": {"status": "generating", "updated_at": now}}
    )

    for chunk in chunks_to_process:
        try:
            user_message = build_user_message(chunk["text"], examples)
            pairs = extract_pairs(system_prompt, user_message)

            for pair in pairs:
                confidence = float(pair.pop("confidence", 0.0))
                reasoning = pair.pop("reasoning", "")

                # whatever is left in pair are the actual fields
                result_doc = {
                    "_id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "chunk_id": chunk["_id"],
                    "chunk_index": chunk["chunk_index"],
                    "source_filename": chunk["source_filename"],
                    "pair": pair,
                    "confidence": confidence,
                    "reasoning": reasoning,
                    "source": "model",
                    "human_reviewed": False,
                    "approved": confidence >= job["confidence_threshold"],
                    "discarded": False,
                    "used_as_example": False,
                    "run_number": run_number,
                    "created_at": now,
                }
                all_results.append(result_doc)

        except Exception as e:
            errors.append({
                "chunk_id": chunk["_id"],
                "chunk_index": chunk["chunk_index"],
                "error": str(e)
            })
            continue

    # 6. also save the human examples as approved results
    for ex in examples:
        result_doc = {
            "_id": str(uuid.uuid4()),
            "job_id": job_id,
            "chunk_id": ex["chunk_id"],
            "chunk_index": ex["chunk_index"],
            "source_filename": ex["source_filename"],
            "pair": ex["pair"],
            "confidence": 1.0,
            "reasoning": "Human labeled example",
            "source": "human",
            "human_reviewed": True,
            "approved": True,
            "discarded": False,
            "used_as_example": False,
            "run_number": run_number,
            "created_at": now,
        }
        all_results.append(result_doc)

    # 7. save all results (remove previous unapproved model results)
    await results_col.delete_many(
        {"job_id": job_id, "source": "model", "approved": False}
    )
    if all_results:
        await results_col.insert_many(all_results)

    # 8. update job status
    high_conf = [r for r in all_results if r["approved"]]
    low_conf = [r for r in all_results if not r["approved"]]

    await jobs_col.update_one(
        {"_id": job_id},
        {"$set": {
            "status": "review",
            "updated_at": datetime.now(timezone.utc),
        }}
    )

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


@router.get("/{job_id}/results")
async def get_results(
    job_id: str,
    include_discarded: bool = False,
    approved: Optional[bool] = None,
    source: Optional[str] = None,
):
    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")

    query = {"job_id": job_id}
    if not include_discarded:
        query["discarded"] = {"$ne": True}
    if approved is not None:
        query["approved"] = approved
    if source:
        query["source"] = source

    cursor = results_col.find(query).sort("chunk_index", 1)
    results = await cursor.to_list(length=2000)
    for r in results:
        r["_id"] = str(r["_id"])

    return {
        "job_id": job_id,
        "total": len(results),
        "results": results,
    }


@router.get("/{job_id}/results/stats")
async def get_results_stats(job_id: str):
    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")

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
async def update_result(job_id: str, result_id: str, body: UpdateResultBody):
    """
    Used in the review screen - human can approve, discard, or edit a low confidence pair.
    """
    existing = await results_col.find_one({"_id": result_id, "job_id": job_id})
    if not existing:
        raise HTTPException(404, "Result not found")

    update_data = {}

    if body.pair is not None:
        job = await jobs_col.find_one({"_id": job_id})
        if not job:
            raise HTTPException(404, "Job not found")
        job_fields = set(job.get("fields", []))
        pair_fields = set(body.pair.keys())
        if pair_fields != job_fields:
            raise HTTPException(400, "Pair fields must exactly match job fields")
        update_data["pair"] = body.pair

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
    return updated


@router.post("/{job_id}/results/{result_id}/add-example")
async def add_example(job_id: str, result_id: str):
    result = await results_col.find_one({"_id": result_id, "job_id": job_id})
    if not result:
        raise HTTPException(404, "Result not found")

    if result.get("discarded") is True:
        raise HTTPException(400, "Result is discarded")

    existing_example = await examples_col.find_one(
        {"job_id": job_id, "chunk_id": result["chunk_id"]}
    )
    if existing_example:
        raise HTTPException(400, "Already added as example")

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await examples_col.insert_one(
        {
            "_id": new_id,
            "job_id": job_id,
            "chunk_id": result["chunk_id"],
            "chunk_index": result["chunk_index"],
            "source_filename": result["source_filename"],
            "pair": result["pair"],
            "source": "feedback",
            "created_at": now,
        }
    )

    await results_col.update_one(
        {"_id": result_id, "job_id": job_id},
        {"$set": {"used_as_example": True}}
    )

    return {"added": True, "example_id": new_id}
