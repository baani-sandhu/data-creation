import csv
import io
import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from app.auth import get_current_user, get_current_user_flexible, get_owned_job
from app.database import chunks_col, datasets_col, results_col

router = APIRouter(tags=["export"])

EXPORT_DIR = "exports"
os.makedirs(EXPORT_DIR, exist_ok=True)


async def _get_chunk_index_by_id(chunk_ids: list[str]) -> dict[str, int]:
    if not chunk_ids:
        return {}

    cursor = chunks_col.find({"_id": {"$in": chunk_ids}})
    chunks = await cursor.to_list(length=len(chunk_ids))
    return {chunk["_id"]: chunk.get("chunk_index", 0) for chunk in chunks}


def _build_export_content(
    *,
    output_format: str,
    fields: list[str],
    pairs: list[dict[str, str]],
    job_id: str,
) -> tuple[str, str, str]:
    if output_format == "json":
        content = json.dumps(pairs, indent=2, ensure_ascii=False)
        media_type = "application/json"
        filename = f"labelforge_{job_id}.json"
    elif output_format == "jsonl":
        lines = [json.dumps(pair, ensure_ascii=False) for pair in pairs]
        content = "\n".join(lines)
        media_type = "application/x-ndjson"
        filename = f"labelforge_{job_id}.jsonl"
    elif output_format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=fields,
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(pairs)
        content = output.getvalue()
        media_type = "text/csv"
        filename = f"labelforge_{job_id}.csv"
    else:
        raise HTTPException(400, f"Unknown format: {output_format}")

    return content, media_type, filename


async def _get_approved_pairs_for_job(job_id: str, fields: list[str]) -> list[dict[str, str]]:
    cursor = results_col.find({
        "job_id": job_id,
        "approved": True,
        "discarded": {"$ne": True},
    })
    results = await cursor.to_list(length=None)
    chunk_index_by_id = await _get_chunk_index_by_id([result["chunk_id"] for result in results])
    results.sort(key=lambda result: chunk_index_by_id.get(result["chunk_id"], 0))

    pairs = []
    for result in results:
        pair = {field: result["pair"].get(field, "") for field in fields}
        pairs.append(pair)
    return pairs


@router.get("/jobs/{job_id}/export")
async def export_dataset(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    output_format = job.get("output_format", "jsonl")
    fields = job["fields"]

    pairs = await _get_approved_pairs_for_job(job_id, fields)
    if not pairs:
        raise HTTPException(400, "No approved results to export")

    content, media_type, filename = _build_export_content(
        output_format=output_format,
        fields=fields,
        pairs=pairs,
        job_id=job_id,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Total-Pairs": str(len(pairs)),
        },
    )


@router.post("/jobs/{job_id}/save-to-gallery")
async def save_to_gallery(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    existing = await datasets_col.find_one({"user_id": user["uid"], "job_id": job_id})
    if existing:
        return {
            "saved": True,
            "already_saved": True,
            "dataset_id": str(existing["_id"]),
        }

    output_format = job.get("output_format", "jsonl")
    fields = job["fields"]
    pairs = await _get_approved_pairs_for_job(job_id, fields)
    if not pairs:
        raise HTTPException(400, "No approved results to save")

    content, _, _ = _build_export_content(
        output_format=output_format,
        fields=fields,
        pairs=pairs,
        job_id=job_id,
    )

    export_path = os.path.join(EXPORT_DIR, f"{user['uid']}_{job_id}.{output_format}")
    with open(export_path, "w", encoding="utf-8", newline="") as export_file:
        export_file.write(content)

    files = job.get("files", [])
    source_filename = files[0].get("filename") if files else job.get("source_filename")
    dataset_id = str(uuid.uuid4())
    await datasets_col.insert_one({
        "_id": dataset_id,
        "user_id": user["uid"],
        "job_id": job_id,
        "filename": source_filename,
        "file_path": export_path,
        "output_format": output_format,
        "pair_count": len(pairs),
        "fields": fields,
        "task_prompt": job.get("task_prompt"),
        "saved_at": datetime.now(timezone.utc),
    })

    return {"saved": True, "dataset_id": dataset_id}


@router.get("/datasets")
async def list_datasets(user: dict = Depends(get_current_user)):
    cursor = datasets_col.find({"user_id": user["uid"]}).sort("saved_at", -1)
    datasets = await cursor.to_list(length=500)
    for dataset in datasets:
        dataset["_id"] = str(dataset["_id"])
    return {"datasets": datasets}


@router.get("/datasets/{dataset_id}/download")
async def download_dataset(dataset_id: str, user: dict = Depends(get_current_user_flexible)):
    dataset = await datasets_col.find_one({"_id": dataset_id})
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.get("user_id") != user["uid"]:
        raise HTTPException(403, "Forbidden")

    file_path = dataset.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(404, "Dataset file not found")

    output_format = dataset.get("output_format", "jsonl")
    if output_format == "json":
        media_type = "application/json"
    elif output_format == "csv":
        media_type = "text/csv"
    else:
        media_type = "application/x-ndjson"

    with open(file_path, "rb") as dataset_file:
        content = dataset_file.read()

    filename = os.path.basename(file_path)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = await datasets_col.find_one({"_id": dataset_id})
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.get("user_id") != user["uid"]:
        raise HTTPException(403, "Forbidden")

    file_path = dataset.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    await datasets_col.delete_one({"_id": dataset_id})
    return {"deleted": dataset_id}
