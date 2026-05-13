import uuid
import logging
import asyncio
from datetime import datetime, timezone

from app.database import augmentation_runs_col, chunks_col, results_col
from app.models.augmentation_run import AugmentationRun
from app.services.augmentation_mode1 import run_mode1_paraphrase_for_chunk
from app.services.augmentation_mode2 import run_mode2_generation_for_chunk
from app.services.noise_detector import calculate_noise_score

DEFAULT_MODE2_SPLIT = 0.5
DEFAULT_MODE1_SPLIT = 1.0 - DEFAULT_MODE2_SPLIT
MAX_PAIRS_PER_CHUNK_MULTIPLIER = 10
logger = logging.getLogger(__name__)


def _normalize_mode2_split(mode_split: float) -> float:
    if mode_split < 0:
        return 0.0
    if mode_split > 1:
        return 1.0
    return mode_split


def _build_shortfall_message(total_generated: int, gap: int) -> str:
    return (
        "Target not fully reachable from current documents. "
        f"Generated {total_generated} of {gap} target pairs. "
        "Add more source documents to reach target."
    )


def _compute_mode_quotas(gap: int, mode2_split: float) -> tuple[int, int]:
    if gap <= 0:
        return 0, 0
    mode2_total_quota = int(round(gap * mode2_split))
    mode1_total_quota = gap - mode2_total_quota
    return mode1_total_quota, mode2_total_quota


async def create_augmentation_run(
    *,
    job_id: str,
    target_size: int,
    mode_split: float = DEFAULT_MODE2_SPLIT,
) -> str:
    augmentation_run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    approved_count = await results_col.count_documents(
        {
            "job_id": job_id,
            "approved": True,
            "discarded": {"$ne": True},
        }
    )
    gap = target_size - approved_count
    mode2_split = _normalize_mode2_split(mode_split)
    mode1_total_quota, mode2_total_quota = _compute_mode_quotas(gap, mode2_split)
    cycle_number = (await augmentation_runs_col.count_documents({"job_id": job_id})) + 1

    run_doc = AugmentationRun(
        augmentation_run_id=augmentation_run_id,
        job_id=job_id,
        target_size=target_size,
        gap=max(gap, 0),
        mode1_quota=mode1_total_quota,
        mode2_quota=mode2_total_quota,
        mode1_generated=0,
        mode2_generated=0,
        cycle_number=cycle_number,
        status="running",
        shortfall_message=None,
        noise_report=None,
        created_at=now,
        completed_at=None,
    ).model_dump()
    await augmentation_runs_col.insert_one(run_doc)
    return augmentation_run_id


async def execute_augmentation_run(augmentation_run_id: str) -> None:
    run_doc = await augmentation_runs_col.find_one({"augmentation_run_id": augmentation_run_id})
    if not run_doc:
        return

    job_id = run_doc["job_id"]
    target_size = int(run_doc["target_size"])

    approved_cursor = results_col.find(
        {
            "job_id": job_id,
            "approved": True,
            "discarded": {"$ne": True},
        }
    )
    approved_pairs = await approved_cursor.to_list(length=None)
    approved_count = len(approved_pairs)
    gap = target_size - approved_count

    if gap <= 0:
        await augmentation_runs_col.update_one(
            {"augmentation_run_id": augmentation_run_id},
            {
                "$set": {
                    "gap": 0,
                    "mode1_quota": 0,
                    "mode2_quota": 0,
                    "status": "completed",
                    "shortfall_message": "Target already reached",
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        return

    mode1_total_quota = int(run_doc.get("mode1_quota", 0))
    mode2_total_quota = int(run_doc.get("mode2_quota", 0))
    cycle_number = int(run_doc.get("cycle_number", 1))
    await augmentation_runs_col.update_one(
        {"augmentation_run_id": augmentation_run_id},
        {"$set": {"gap": gap, "status": "running"}},
    )

    chunks_cursor = chunks_col.find({"job_id": job_id}).sort("chunk_index", 1)
    all_chunks = await chunks_cursor.to_list(length=None)
    print(
        "[orchestrator] run start: "
        f"job_id={job_id} target_size={target_size} gap={gap} "
        f"total_chunks={len(all_chunks)} total_approved_pairs={approved_count}"
    )

    if approved_count == 0 or not all_chunks:
        shortfall_message = _build_shortfall_message(0, gap)
        await augmentation_runs_col.update_one(
            {"augmentation_run_id": augmentation_run_id},
            {
                "$set": {
                    "mode1_generated": 0,
                    "mode2_generated": 0,
                    "status": "partial",
                    "shortfall_message": shortfall_message,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        return

    approved_pairs_by_chunk: dict[str, list[dict]] = {}
    for pair_doc in approved_pairs:
        chunk_id = pair_doc.get("chunk_id")
        if not chunk_id:
            continue
        approved_pairs_by_chunk.setdefault(chunk_id, []).append(pair_doc)

    chunk_plan = []
    for chunk in all_chunks:
        chunk_id = chunk.get("_id")
        chunk_pairs = approved_pairs_by_chunk.get(chunk_id, [])
        chunk_original_count = len(chunk_pairs)
        if chunk_original_count == 0:
            continue

        chunk_weight = chunk_original_count / approved_count
        raw_mode2_quota = int(mode2_total_quota * chunk_weight)
        raw_mode1_quota = int(mode1_total_quota * chunk_weight)
        cap = MAX_PAIRS_PER_CHUNK_MULTIPLIER * chunk_original_count
        chunk_quota_mode2 = min(raw_mode2_quota, cap)
        chunk_quota_mode1 = min(raw_mode1_quota, cap)

        chunk_plan.append(
            {
                "chunk": chunk,
                "approved_pairs": chunk_pairs,
                "mode2_quota": chunk_quota_mode2,
                "mode1_quota": chunk_quota_mode1,
            }
        )
        print(
            "[orchestrator] chunk plan: "
            f"chunk_id={chunk_id} mode1_quota={chunk_quota_mode1} "
            f"mode2_quota={chunk_quota_mode2} approved_pairs_count={chunk_original_count}"
        )

    mode1_generated = 0
    mode2_generated = 0

    for item in chunk_plan:
        try:
            generated = await run_mode2_generation_for_chunk(
                job_id=job_id,
                chunk=item["chunk"],
                existing_approved_pairs=[doc.get("pair", {}) for doc in item["approved_pairs"]],
                quota=item["mode2_quota"],
                augmentation_run_id=augmentation_run_id,
                augmentation_cycle=cycle_number,
            )
            print(
                "[orchestrator] mode2 chunk complete: "
                f"chunk_id={item['chunk'].get('_id')} inserted={generated}"
            )
            mode2_generated += generated
            await augmentation_runs_col.update_one(
                {"augmentation_run_id": augmentation_run_id},
                {"$set": {"mode2_generated": mode2_generated}},
            )
        except Exception:
            print(
                "[orchestrator] mode2 chunk exception: "
                f"chunk_id={item['chunk'].get('_id')} job_id={job_id}"
            )
            logger.exception(
                "mode2 chunk failed: chunk_id=%s job_id=%s",
                item["chunk"].get("_id"),
                job_id,
            )

    for item in chunk_plan:
        try:
            generated = await run_mode1_paraphrase_for_chunk(
                job_id=job_id,
                chunk=item["chunk"],
                approved_pairs_for_chunk=item["approved_pairs"],
                quota=item["mode1_quota"],
                augmentation_run_id=augmentation_run_id,
                augmentation_cycle=cycle_number,
            )
            print(
                "[orchestrator] mode1 chunk complete: "
                f"chunk_id={item['chunk'].get('_id')} inserted={generated}"
            )
            mode1_generated += generated
            await augmentation_runs_col.update_one(
                {"augmentation_run_id": augmentation_run_id},
                {"$set": {"mode1_generated": mode1_generated}},
            )
        except Exception:
            print(
                "[orchestrator] mode1 chunk exception: "
                f"chunk_id={item['chunk'].get('_id')} job_id={job_id}"
            )
            logger.exception(
                "mode1 chunk failed: chunk_id=%s job_id=%s",
                item["chunk"].get("_id"),
                job_id,
            )

    total_generated = mode2_generated + mode1_generated
    if total_generated >= gap:
        final_status = "completed"
        shortfall_message = None
    else:
        final_status = "partial"
        shortfall_message = _build_shortfall_message(total_generated, gap)

    # Noise check is computed only for paraphrased pairs that map to an original pair.
    augmented_docs = await results_col.find(
        {
            "job_id": job_id,
            "augmentation_run_id": augmentation_run_id,
            "is_augmented": True,
        }
    ).to_list(length=None)
    paraphrased_docs = [
        doc
        for doc in augmented_docs
        if doc.get("augmentation_source") == "paraphrase" and doc.get("original_result_id")
    ]

    original_ids = [doc["original_result_id"] for doc in paraphrased_docs if doc.get("original_result_id")]
    original_docs = await results_col.find({"_id": {"$in": original_ids}}).to_list(length=None) if original_ids else []
    original_lookup = {doc["_id"]: doc.get("pair", {}) for doc in original_docs}

    aug_pairs: list[dict] = []
    orig_pairs: list[dict] = []
    for doc in paraphrased_docs:
        orig_id = doc.get("original_result_id")
        orig_pair = original_lookup.get(orig_id)
        if isinstance(doc.get("pair"), dict) and isinstance(orig_pair, dict):
            aug_pairs.append(doc["pair"])
            orig_pairs.append(orig_pair)

    generated_excluded = len([doc for doc in augmented_docs if doc.get("augmentation_source") == "generation"])
    try:
        noise_result = await asyncio.get_running_loop().run_in_executor(
            None,
            calculate_noise_score,
            aug_pairs,
            orig_pairs,
        )
    except Exception:
        logger.exception("noise calculation failed for augmentation_run_id=%s", augmentation_run_id)
        noise_result = {
            "noise_score": 0.0,
            "noise_percentage": 0.0,
            "redundancy_rate": 0.0,
            "drift_rate": 0.0,
            "redundant_count": 0,
            "drifted_count": 0,
            "total_checked": 0,
            "status": "warning",
            "message": "Noise calculation failed. Please review augmented data manually.",
        }
    noise_result["scope_note"] = (
        f"Noise calculated on {len(aug_pairs)} paraphrased pairs. "
        f"{generated_excluded} generated pairs excluded (no original to compare against)."
    )
    noise_result["excluded_generated_pairs"] = generated_excluded

    await augmentation_runs_col.update_one(
        {"augmentation_run_id": augmentation_run_id},
        {
            "$set": {
                "mode1_generated": mode1_generated,
                "mode2_generated": mode2_generated,
                "status": final_status,
                "shortfall_message": shortfall_message,
                "noise_report": noise_result,
                "completed_at": datetime.now(timezone.utc),
            }
        },
    )


async def run_augmentation_for_job(
    *,
    job_id: str,
    target_size: int,
    mode_split: float = DEFAULT_MODE2_SPLIT,
) -> str:
    augmentation_run_id = await create_augmentation_run(
        job_id=job_id,
        target_size=target_size,
        mode_split=mode_split,
    )
    await execute_augmentation_run(augmentation_run_id)
    return augmentation_run_id
