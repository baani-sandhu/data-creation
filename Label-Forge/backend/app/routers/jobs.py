from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import List
from app.database import jobs_col, chunks_col
from app.services.extractor import extract
from app.services.chunker import chunk
from app.auth import get_current_user, get_owned_job
from datetime import datetime, timezone
import uuid, aiofiles, os

router = APIRouter(prefix="/jobs", tags=["jobs"])
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "csv"}
MAX_FILE_SIZE = 50 * 1024 * 1024

@router.post("/")
async def create_job(
    user: dict = Depends(get_current_user),
    files: List[UploadFile] = File(...),
    fields: str = Form(...),
    task_prompt: str = Form(...),
    output_format: str = Form("jsonl"),
    confidence_threshold: float = Form(0.75),
):
    if not files:
        raise HTTPException(400, "No files uploaded")

    field_list = [f.strip() for f in fields.split(",") if f.strip()]
    if len(field_list) < 2:
        raise HTTPException(400, "At least 2 fields required")

    if not task_prompt.strip():
        raise HTTPException(400, "Task prompt is required")

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    all_chunks = []
    processed_files = []
    errors = []

    for file in files:
        ext = file.filename.split(".")[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            errors.append({"filename": file.filename, "error": f"Unsupported type .{ext}"})
            continue

        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            errors.append({"filename": file.filename, "error": "File too large. Max 50MB."})
            continue

        safe_name = file.filename.replace(" ", "_")
        file_path = f"{UPLOAD_DIR}/{job_id}_{safe_name}"
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_bytes)

        try:
            text = extract(file_bytes, ext)
            if not text.strip():
                errors.append({"filename": file.filename, "error": "No text extracted"})
                continue

            file_chunks = chunk(text, strategy="auto")
            if not file_chunks:
                errors.append({"filename": file.filename, "error": "No chunks produced"})
                continue

            for i, chunk_text in enumerate(file_chunks):
                all_chunks.append({
                    "text": chunk_text,
                    "source_filename": file.filename,
                    "chunk_index_in_file": i,
                    "is_first_chunk": i == 0,
                })

            processed_files.append({
                "filename": file.filename,
                "file_path": file_path,
                "source_type": ext,
                "chunk_count": len(file_chunks),
                "file_size": len(file_bytes),
            })

        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
            continue

    if not all_chunks:
        raise HTTPException(400, {"message": "No files could be processed", "errors": errors})

    chunk_docs = [
        {
            "_id": str(uuid.uuid4()),
            "job_id": job_id,
            "user_id": user["uid"],
            "chunk_index": i,
            "chunk_index_in_file": c["chunk_index_in_file"],
            "is_first_chunk": c["is_first_chunk"],
            "source_filename": c["source_filename"],
            "text": c["text"],
            "word_count": len(c["text"].split()),
            "created_at": now,
        }
        for i, c in enumerate(all_chunks)
    ]
    await chunks_col.insert_many(chunk_docs)

    job_doc = {
        "_id": job_id,
        "user_id": user["uid"],
        "status": "chunked",
        "fields": field_list,
        "task_prompt": task_prompt,
        "confidence_threshold": confidence_threshold,
        "output_format": output_format,
        "files": processed_files,
        "chunk_count": len(chunk_docs),
        "token_usage": 0,
        "errors": errors,
        "created_at": now,
        "updated_at": now,
    }
    await jobs_col.insert_one(job_doc)

    return {
        "job_id": job_id,
        "status": "chunked",
        "files_processed": len(processed_files),
        "files_failed": len(errors),
        "total_chunks": len(chunk_docs),
        "fields": field_list,
        "task_prompt": task_prompt,
        "confidence_threshold": confidence_threshold,
        "errors": errors if errors else None,
        "first_chunk": {
            "chunk_id": chunk_docs[0]["_id"],
            "text": chunk_docs[0]["text"],
            "word_count": chunk_docs[0]["word_count"],
        } if chunk_docs else None,
    }

@router.get("/")
async def list_jobs(user: dict = Depends(get_current_user)):
    cursor = jobs_col.find(
        {"user_id": user["uid"]},
        {
            "_id": 1,
            "status": 1,
            "files": 1,
            "created_at": 1,
            "chunk_count": 1,
        },
    ).sort("created_at", -1)

    jobs = await cursor.to_list(length=200)
    items = []
    for job in jobs:
        first_file = (job.get("files") or [{}])[0]
        items.append({
            "_id": str(job["_id"]),
            "status": job.get("status"),
            "source_filename": first_file.get("filename"),
            "created_at": job.get("created_at"),
            "chunk_count": job.get("chunk_count", 0),
        })

    return {"jobs": items}

@router.get("/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    job["_id"] = str(job["_id"])
    return job

@router.get("/{job_id}/chunks")
async def get_chunks(job_id: str, skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)

    total = await chunks_col.count_documents({"job_id": job_id, "user_id": user["uid"]})
    cursor = chunks_col.find(
        {"job_id": job_id, "user_id": user["uid"]}
    ).sort("chunk_index", 1).skip(skip).limit(limit)

    chunks = await cursor.to_list(length=limit)
    for c in chunks:
        c["_id"] = str(c["_id"])

    return {
        "job_id": job_id,
        "total": total,
        "skip": skip,
        "limit": limit,
        "chunks": chunks,
    }
