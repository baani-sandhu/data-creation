import uuid
from datetime import datetime, timezone

from app.database import augmentation_runs_col, chunks_col, results_col
from app.models.augmentation_run import AugmentationRun
from app.services.augmentation_mode1 import run_mode1_paraphrase_for_chunk
from app.services.augmentation_mode2 import run_mode2_generation_for_chunk

DEFAULT_MODE2_SPLIT = 0.5
DEFAULT_MODE1_SPLIT = 1.0 - DEFAULT_MODE2_SPLIT
MAX_PAIRS_PER_CHUNK_MULTIPLIER = 10


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

    run_doc = AugmentationRun(
        augmentation_run_id=augmentation_run_id,
        job_id=job_id,
        target_size=target_size,
        gap=max(gap, 0),
        mode1_quota=mode1_total_quota,
        mode2_quota=mode2_total_quota,
        mode1_generated=0,
        mode2_generated=0,
        status="running",
        shortfall_message=None,
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
    await augmentation_runs_col.update_one(
        {"augmentation_run_id": augmentation_run_id},
        {"$set": {"gap": gap, "status": "running"}},
    )

    chunks_cursor = chunks_col.find({"job_id": job_id}).sort("chunk_index", 1)
    all_chunks = await chunks_cursor.to_list(length=None)

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

    mode2_generated = 0
    for item in chunk_plan:
        if item["mode2_quota"] <= 0:
            continue
        generated = await run_mode2_generation_for_chunk(
            job_id=job_id,
            chunk=item["chunk"],
            existing_approved_pairs=[doc.get("pair", {}) for doc in item["approved_pairs"]],
            quota=item["mode2_quota"],
            augmentation_run_id=augmentation_run_id,
        )
        mode2_generated += generated
        await augmentation_runs_col.update_one(
            {"augmentation_run_id": augmentation_run_id},
            {"$set": {"mode2_generated": mode2_generated}},
        )

    mode1_generated = 0
    for item in chunk_plan:
        if item["mode1_quota"] <= 0:
            continue
        generated = await run_mode1_paraphrase_for_chunk(
            job_id=job_id,
            chunk=item["chunk"],
            approved_pairs_for_chunk=item["approved_pairs"],
            quota=item["mode1_quota"],
            augmentation_run_id=augmentation_run_id,
        )
        mode1_generated += generated
        await augmentation_runs_col.update_one(
            {"augmentation_run_id": augmentation_run_id},
            {"$set": {"mode1_generated": mode1_generated}},
        )

    total_generated = mode2_generated + mode1_generated
    if total_generated >= gap:
        final_status = "completed"
        shortfall_message = None
    else:
        final_status = "partial"
        shortfall_message = _build_shortfall_message(total_generated, gap)

    await augmentation_runs_col.update_one(
        {"augmentation_run_id": augmentation_run_id},
        {
            "$set": {
                "mode1_generated": mode1_generated,
                "mode2_generated": mode2_generated,
                "status": final_status,
                "shortfall_message": shortfall_message,
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
