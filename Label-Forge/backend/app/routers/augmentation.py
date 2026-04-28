from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user, get_owned_job
from app.database import augmentation_runs_col, results_col
from app.services.augmentation_orchestrator import (
    DEFAULT_MODE2_SPLIT,
    create_augmentation_run,
    execute_augmentation_run,
)

router = APIRouter(prefix="/augmentation", tags=["augmentation"])


class StartAugmentationBody(BaseModel):
    job_id: str
    target_size: int = Field(..., ge=0)
    mode_split: float = DEFAULT_MODE2_SPLIT


def _format_run_response(run_doc: dict) -> dict:
    return {
        "augmentation_run_id": run_doc["augmentation_run_id"],
        "status": run_doc.get("status"),
        "mode1_generated": int(run_doc.get("mode1_generated", 0)),
        "mode2_generated": int(run_doc.get("mode2_generated", 0)),
        "mode1_quota": int(run_doc.get("mode1_quota", 0)),
        "mode2_quota": int(run_doc.get("mode2_quota", 0)),
        "shortfall_message": run_doc.get("shortfall_message"),
        "created_at": run_doc.get("created_at"),
        "completed_at": run_doc.get("completed_at"),
    }


@router.post("/start")
async def start_augmentation(
    body: StartAugmentationBody,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    await get_owned_job(body.job_id, user)

    approved_count = await results_col.count_documents(
        {
            "job_id": body.job_id,
            "approved": True,
            "discarded": {"$ne": True},
        }
    )
    if body.target_size <= approved_count:
        raise HTTPException(
            400,
            f"target_size must be greater than current approved pair count ({approved_count}).",
        )

    augmentation_run_id = await create_augmentation_run(
        job_id=body.job_id,
        target_size=body.target_size,
        mode_split=body.mode_split,
    )
    background_tasks.add_task(execute_augmentation_run, augmentation_run_id)

    return {"augmentation_run_id": augmentation_run_id, "status": "running"}


@router.get("/{run_id}/status")
async def get_augmentation_status(run_id: str, user: dict = Depends(get_current_user)):
    run_doc = await augmentation_runs_col.find_one({"augmentation_run_id": run_id})
    if not run_doc:
        raise HTTPException(404, "Augmentation run not found")

    await get_owned_job(run_doc["job_id"], user)
    return _format_run_response(run_doc)


@router.get("/{run_id}/results")
async def get_augmentation_results(run_id: str, user: dict = Depends(get_current_user)):
    run_doc = await augmentation_runs_col.find_one({"augmentation_run_id": run_id})
    if not run_doc:
        raise HTTPException(404, "Augmentation run not found")

    await get_owned_job(run_doc["job_id"], user)
    return _format_run_response(run_doc)
