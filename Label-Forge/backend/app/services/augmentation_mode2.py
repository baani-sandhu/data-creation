import math
import uuid
from datetime import datetime, timezone

from app.database import jobs_col, results_col
from app.services.llm_service import extract_pairs
from app.services.pair_hash import compute_pair_hash
from app.services.prompt_builder import (
    build_mode2_generation_system_prompt,
    build_mode2_generation_user_message,
)


async def run_mode2_generation_for_chunk(
    *,
    job_id: str,
    chunk: dict,
    existing_approved_pairs: list[dict],
    quota: int,
    augmentation_run_id: str,
    pairs_per_call: int = 50,
) -> int:
    if quota <= 0:
        return 0

    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise ValueError(f"Job not found: {job_id}")

    fields = job.get("fields", [])
    if not fields:
        return 0

    system_prompt = build_mode2_generation_system_prompt(job["task_prompt"], fields)
    max_attempts = math.ceil(quota / pairs_per_call) * 2
    inserted_count = 0

    # This is the "already covered" context that grows every loop.
    negative_context = [pair for pair in existing_approved_pairs if isinstance(pair, dict)]

    for _ in range(max_attempts):
        if inserted_count >= quota:
            break

        remaining_quota = quota - inserted_count
        requested_count = min(pairs_per_call, remaining_quota)
        user_message = build_mode2_generation_user_message(
            chunk_text=chunk.get("text", ""),
            fields=fields,
            existing_pairs=negative_context,
            requested_count=requested_count,
        )

        generated = await extract_pairs(system_prompt, user_message)
        if not generated:
            continue

        docs_to_insert = []
        newly_inserted_pairs_for_negative_context = []
        now = datetime.now(timezone.utc)

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

            try:
                confidence = float(confidence_raw)
            except (TypeError, ValueError):
                confidence = 0.0

            doc = {
                "_id": str(uuid.uuid4()),
                "job_id": job_id,
                "chunk_id": chunk["_id"],
                "pair": pair_values,
                "pair_hash": pair_hash,
                "confidence": confidence,
                "reasoning": reasoning,
                "source": "model",
                "human_reviewed": False,
                "approved": confidence >= float(job.get("confidence_threshold", 0.75)),
                "discarded": False,
                "used_as_example": False,
                "created_at": now,
                "is_augmented": True,
                "augmentation_source": "generation",
                "parent_pair_id": None,
                "augmentation_run_id": augmentation_run_id,
            }
            docs_to_insert.append(doc)
            newly_inserted_pairs_for_negative_context.append(pair_values)

        if not docs_to_insert:
            continue

        await results_col.insert_many(docs_to_insert)
        inserted_count += len(docs_to_insert)
        negative_context.extend(newly_inserted_pairs_for_negative_context)

    return inserted_count
