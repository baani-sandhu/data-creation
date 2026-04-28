import math
import uuid
from datetime import datetime, timezone

from app.database import jobs_col, results_col
from app.services.llm_service import extract_pairs
from app.services.pair_hash import compute_pair_hash
from app.services.prompt_builder import (
    build_mode1_paraphrase_system_prompt,
    build_mode1_paraphrase_user_message,
)


def _build_sub_batches(approved_pairs_for_chunk: list[dict], pairs_per_call: int) -> list[list[dict]]:
    sub_batches: list[list[dict]] = []
    for i in range(0, len(approved_pairs_for_chunk), pairs_per_call):
        sub_batches.append(approved_pairs_for_chunk[i : i + pairs_per_call])
    return sub_batches


async def run_mode1_paraphrase_for_chunk(
    *,
    job_id: str,
    chunk: dict,
    approved_pairs_for_chunk: list[dict],
    quota: int,
    augmentation_run_id: str,
    pairs_per_call: int = 50,
) -> int:
    if quota <= 0:
        return 0
    if not approved_pairs_for_chunk:
        return 0

    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise ValueError(f"Job not found: {job_id}")

    fields = job.get("fields", [])
    if not fields:
        return 0

    system_prompt = build_mode1_paraphrase_system_prompt(job["task_prompt"], fields)
    max_attempts = math.ceil(quota / pairs_per_call) * 2
    inserted_count = 0

    sub_batches = _build_sub_batches(approved_pairs_for_chunk, pairs_per_call)
    if not sub_batches:
        return 0

    for attempt in range(max_attempts):
        if inserted_count >= quota:
            break

        batch = sub_batches[attempt % len(sub_batches)]
        model_batch = []
        source_pair_map: dict[str, dict] = {}
        for item in batch:
            pair_id = str(item.get("_id", ""))
            pair_values = item.get("pair")
            if not pair_id or not isinstance(pair_values, dict):
                continue
            mapped = {
                "source_pair_id": pair_id,
                **{field: pair_values.get(field, "") for field in fields},
            }
            model_batch.append(mapped)
            source_pair_map[pair_id] = pair_values

        if not model_batch:
            continue

        user_message = build_mode1_paraphrase_user_message(
            chunk_text=chunk.get("text", ""),
            fields=fields,
            pair_batch=model_batch,
        )
        paraphrased = await extract_pairs(system_prompt, user_message)
        if not paraphrased:
            continue

        now = datetime.now(timezone.utc)
        docs_to_insert = []

        for raw_pair in paraphrased:
            if inserted_count + len(docs_to_insert) >= quota:
                break
            if not isinstance(raw_pair, dict):
                continue

            source_pair_id = str(raw_pair.get("source_pair_id", "")).strip()
            if not source_pair_id:
                continue
            if source_pair_id not in source_pair_map:
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
                "augmentation_source": "paraphrase",
                "parent_pair_id": source_pair_id,
                "augmentation_run_id": augmentation_run_id,
            }
            docs_to_insert.append(doc)

        if not docs_to_insert:
            continue

        await results_col.insert_many(docs_to_insert)
        inserted_count += len(docs_to_insert)

    return inserted_count
