import uuid
import logging
from datetime import datetime, timezone

from app.database import jobs_col, results_col
from app.services.llm_service import extract_pairs
from app.services.pair_hash import compute_pair_hash
from app.services.prompt_builder import (
    build_mode1_paraphrase_system_prompt,
    build_mode1_paraphrase_user_message,
)

logger = logging.getLogger(__name__)


async def run_mode1_paraphrase_for_chunk(
    *,
    job_id: str,
    chunk: dict,
    approved_pairs_for_chunk: list[dict],
    quota: int,
    augmentation_run_id: str,
) -> int:
    print(
        f"[mode1] entered run_mode1_paraphrase_for_chunk job_id={job_id} chunk_id={chunk.get('_id')} quota={quota}"
    )
    try:
        if not approved_pairs_for_chunk:
            return 0

        job = await jobs_col.find_one({"_id": job_id})
        if not job:
            raise ValueError(f"Job not found: {job_id}")

        fields = job.get("fields", [])
        if not fields:
            return 0

        system_prompt = build_mode1_paraphrase_system_prompt(job["task_prompt"], fields)
        inserted_count = 0

        model_batch = []
        source_pair_map: dict[str, dict] = {}
        valid_id_count = 0
        valid_pair_dict_count = 0
        for item in approved_pairs_for_chunk:
            pair_id = str(item.get("_id", ""))
            pair_values = item.get("pair")
            has_valid_id = bool(pair_id)
            has_valid_pair_dict = isinstance(pair_values, dict)
            if has_valid_id:
                valid_id_count += 1
            if has_valid_pair_dict:
                valid_pair_dict_count += 1
            if not has_valid_id or not has_valid_pair_dict:
                continue
            mapped = {
                "source_pair_id": pair_id,
                **{field: pair_values.get(field, "") for field in fields},
            }
            model_batch.append(mapped)
            source_pair_map[pair_id] = pair_values

        print(
            "[mode1] batch build: "
            f"approved_total={len(approved_pairs_for_chunk)} "
            f"valid_id={valid_id_count} "
            f"valid_pair_dict={valid_pair_dict_count} "
            f"model_batch_len={len(model_batch)}"
        )

        if not model_batch:
            return 0

        user_message = build_mode1_paraphrase_user_message(
            chunk_text=chunk.get("text", ""),
            fields=fields,
            pair_batch=model_batch,
            requested_count=quota,
        )
        paraphrased = await extract_pairs(system_prompt, user_message)
        if not paraphrased:
            print("[mode1] gemini result: raw_len=0 dedup_pass=0 threshold_pass=0 docs_to_insert_len=0")
            return 0

        now = datetime.now(timezone.utc)
        docs_to_insert = []
        dedup_pass_count = 0
        threshold_pass_count = 0

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

        print(
            "[mode1] gemini result: "
            f"raw_len={len(paraphrased)} "
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
        print(f"[mode1] exception job_id={job_id} chunk_id={chunk.get('_id')}")
        logger.exception("mode1 run failed for job_id=%s chunk_id=%s", job_id, chunk.get("_id"))
        return 0
