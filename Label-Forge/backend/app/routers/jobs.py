import json
import traceback

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks, Request
from typing import List
from pydantic import BaseModel
from app.database import jobs_col, chunks_col, results_col, documents_col
from app.services.extractor import extract
from app.services.chunker import chunk
from app.auth import get_current_user, get_owned_job
from app.limiter import limiter
from datetime import datetime, timezone
import uuid, aiofiles, os, asyncio

router = APIRouter(prefix="/jobs", tags=["jobs"])
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
UPLOAD_DIR = os.path.normpath(UPLOAD_DIR)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "csv", "pptx", "docx", "xlsx", "xls"}


class CreateJobFromDocumentBody(BaseModel):
    document_id: str
    fields: list[str]
    task_prompt: str
    output_format: str = "jsonl"
    confidence_threshold: float = 0.75


def _parse_examples(examples_raw: str | None, field_list: list[str]) -> list[dict[str, object]]:
    if not examples_raw:
        return []

    try:
        parsed = json.loads(examples_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"Invalid examples JSON: {exc.msg}") from exc

    if not isinstance(parsed, list):
        raise HTTPException(400, "Examples must be a JSON array")

    examples = []
    for example in parsed:
        if not isinstance(example, dict):
            raise HTTPException(400, "Each example must be an object")
        input_value = example.get("input")
        output_value = example.get("output")
        if not isinstance(input_value, str):
            raise HTTPException(400, 'Each example must include "input" as a string')
        if not isinstance(output_value, dict):
            raise HTTPException(400, 'Each example must include "output" as an object')
        if not all(isinstance(key, str) for key in output_value.keys()):
            raise HTTPException(400, 'Each example "output" key must be a string')
        if not all(isinstance(value, str) for value in output_value.values()):
            raise HTTPException(400, 'Each example "output" value must be a string')
        examples.append({"input": input_value, "output": output_value})

    return examples


async def _upsert_document(
    *,
    user_id: str,
    source_job_id: str,
    filename: str,
    file_path: str,
    ext: str,
    file_size: int,
    chunk_count: int,
    now: datetime,
):
    try:
        existing = await documents_col.find_one({
            "user_id": user_id,
            "original_filename": filename,
        })
        if not existing:
            await documents_col.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": user_id,
                "source_job_id": source_job_id,
                "original_filename": filename,
                "file_path": file_path,
                "file_type": ext,
                "file_size": file_size,
                "chunk_count": chunk_count,
                "chunk_strategy": "auto",
                "created_at": now,
            })
            return

        await documents_col.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "source_job_id": source_job_id,
                "file_path": file_path,
                "chunk_count": chunk_count,
            }},
        )
    except Exception:
        pass


async def process_job(job_id: str, saved_files: list[dict], user_id: str):
    print(f"[process_job] START job_id={job_id}")
    print(f"[process_job] saved_files={saved_files}")
    try:
        await jobs_col.update_one(
            {"_id": job_id, "user_id": user_id},
            {"$set": {"status": "extracting", "updated_at": datetime.now(timezone.utc)}}
        )
        print(f"[process_job] status set to extracting")

        extracted_files = []
        errors = []

        for file_info in saved_files:
            try:
                print(f"[process_job] extracting file: {file_info['filename']}")
                async with aiofiles.open(file_info["file_path"], "rb") as f:
                    file_bytes = await f.read()

                text = extract(file_bytes, file_info["ext"])
                print(f"[process_job] extracted text length: {len(text) if text else 0}")
                if not text or not text.strip():
                    errors.append({"filename": file_info["filename"], "error": "No text extracted"})
                    continue

                extracted_files.append({
                    **file_info,
                    "text": text,
                })
            except Exception as e:
                full_trace = traceback.format_exc()
                print(f"[process_job] per-file extraction error ({file_info.get('filename')}): {full_trace}")
                errors.append({"filename": file_info["filename"], "error": full_trace})
                continue

        await jobs_col.update_one(
            {"_id": job_id, "user_id": user_id},
            {"$set": {"status": "chunking", "updated_at": datetime.now(timezone.utc)}}
        )
        print(f"[process_job] status set to chunking")

        now = datetime.now(timezone.utc)
        chunk_docs = []
        processed_files = []
        chunk_index = 0

        for extracted_file in extracted_files:
            try:
                file_chunks = chunk(extracted_file["text"])
                print(f"[process_job] chunks produced: {len(file_chunks)}")
                if not file_chunks:
                    errors.append({"filename": extracted_file["filename"], "error": "No chunks produced"})
                    continue

                for chunk_text in file_chunks:
                    chunk_docs.append({
                        "_id": str(uuid.uuid4()),
                        "job_id": job_id,
                        "chunk_index": chunk_index,
                        "source_filename": extracted_file["filename"],
                        "text": chunk_text,
                        "created_at": now,
                    })
                    chunk_index += 1

                await _upsert_document(
                    user_id=user_id,
                    source_job_id=job_id,
                    filename=extracted_file["filename"],
                    file_path=extracted_file["file_path"],
                    ext=extracted_file["ext"],
                    file_size=extracted_file["file_size"],
                    chunk_count=len(file_chunks),
                    now=now,
                )

                processed_files.append({
                    "filename": extracted_file["filename"],
                    "file_path": extracted_file["file_path"],
                    "source_type": extracted_file["ext"],
                    "chunk_count": len(file_chunks),
                    "file_size": extracted_file["file_size"],
                })
            except Exception as e:
                full_trace = traceback.format_exc()
                print(f"[process_job] per-file chunking error ({extracted_file.get('filename')}): {full_trace}")
                errors.append({"filename": extracted_file["filename"], "error": full_trace})
                continue

        if chunk_docs:
            await chunks_col.insert_many(chunk_docs)
            print(f"[process_job] inserted {len(chunk_docs)} chunks to MongoDB")

        if not chunk_docs:
            await jobs_col.update_one(
                {"_id": job_id, "user_id": user_id},
                {"$set": {
                    "status": "failed",
                    "error": "No files could be processed",
                    "errors": errors if errors else None,
                    "updated_at": datetime.now(timezone.utc),
                }}
            )
            return

        await jobs_col.update_one(
            {"_id": job_id, "user_id": user_id},
            {"$set": {
                "status": "chunked",
                "files": processed_files,
                "chunk_count": len(chunk_docs),
                "errors": errors if errors else None,
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        print(f"[process_job] DONE status=chunked")
        print("ENTER GENERATION STEP")
        from app.routers.generation import run_generation_for_job
        await run_generation_for_job(job_id, user_id)
        print(f"[process_job] DONE status=review")
    except Exception as e:
        full_trace = traceback.format_exc()
        print(f"[process_job] FATAL ERROR: {e}")
        print(full_trace)
        print(f"[process_job] FATAL: {full_trace}")
        await jobs_col.update_one(
            {"_id": job_id, "user_id": user_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "traceback": full_trace,
                "updated_at": datetime.now(timezone.utc),
            }}
        )


@router.post("/")
@limiter.limit("10/minute")
async def create_job(
    request: Request,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    files: List[UploadFile] = File(...),
    fields: str = Form(...),
    task_prompt: str = Form(...),
    output_format: str = Form("jsonl"),
    confidence_threshold: float = Form(0.75),
    examples: str | None = Form(None),
):
    if not files:
        raise HTTPException(400, "No files uploaded")

    field_list = [f.strip() for f in fields.split(",") if f.strip()]
    if len(field_list) < 2:
        raise HTTPException(400, "At least 2 fields required")

    if not task_prompt.strip():
        raise HTTPException(400, "Task prompt is required")

    parsed_examples = _parse_examples(examples, field_list)

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    saved_files = []
    errors = []

    for file in files:
        ext = file.filename.split(".")[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            errors.append({"filename": file.filename, "error": f"Unsupported type .{ext}"})
            continue

        file_bytes = await file.read()
        safe_name = file.filename.replace(" ", "_")
        file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{safe_name}")
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_bytes)

        saved_files.append({
            "filename": file.filename,
            "file_path": file_path,
            "ext": ext,
            "file_size": len(file_bytes),
        })

    if not saved_files:
        raise HTTPException(400, {"message": "No files could be processed", "errors": errors})

    job_doc = {
        "_id": job_id,
        "user_id": user["uid"],
        "status": "pending",
        "fields": field_list,
        "task_prompt": task_prompt,
        "confidence_threshold": confidence_threshold,
        "output_format": output_format,
        "examples": parsed_examples,
        "files": [
            {
                "filename": f["filename"],
                "file_path": f["file_path"],
                "source_type": f["ext"],
                "chunk_count": 0,
                "file_size": f["file_size"],
            }
            for f in saved_files
        ],
        "created_at": now,
        "updated_at": now,
    }
    await jobs_col.insert_one(job_doc)
    background_tasks.add_task(process_job, job_id, saved_files, user["uid"])

    return {
        "job_id": job_id,
        "status": "pending",
        "files_processed": len(saved_files),
        "files_failed": len(errors),
        "total_chunks": 0,
        "fields": field_list,
        "task_prompt": task_prompt,
        "confidence_threshold": confidence_threshold,
        "errors": errors if errors else None,
        "first_chunk": None,
    }


@router.post("/from-document")
@limiter.limit("10/minute")
async def create_job_from_document(
    request: Request,
    body: CreateJobFromDocumentBody,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    field_list = [f.strip() for f in body.fields if isinstance(f, str) and f.strip()]
    if len(field_list) < 2:
        raise HTTPException(400, "At least 2 fields required")
    if not body.task_prompt.strip():
        raise HTTPException(400, "Task prompt is required")

    document = await documents_col.find_one({"_id": body.document_id})
    if not document:
        raise HTTPException(404, "Document not found")
    if document.get("user_id") != user["uid"]:
        raise HTTPException(403, "Forbidden")

    original_filename = document.get("original_filename")
    source_job_id = document.get("source_job_id")

    source_chunks = []
    if source_job_id:
        cursor = chunks_col.find({"job_id": source_job_id}).sort("chunk_index", 1)
        source_chunks = await cursor.to_list(length=None)

    if not source_chunks and original_filename:
        candidate_jobs_cursor = jobs_col.find(
            {"user_id": user["uid"], "files.filename": original_filename}
        ).sort("created_at", -1)
        candidate_jobs = await candidate_jobs_cursor.to_list(length=200)

        for candidate in candidate_jobs:
            candidate_job_id = str(candidate["_id"])
            cursor = chunks_col.find(
                {"job_id": candidate_job_id, "source_filename": original_filename}
            ).sort("chunk_index", 1)
            candidate_chunks = await cursor.to_list(length=None)
            if candidate_chunks:
                source_chunks = candidate_chunks
                source_job_id = candidate_job_id
                break

    if not source_chunks:
        raise HTTPException(400, "No source chunks found for this document")

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    chunk_docs = []
    for i, source in enumerate(source_chunks):
        chunk_docs.append({
            "_id": str(uuid.uuid4()),
            "job_id": job_id,
            "chunk_index": i,
            "source_filename": source.get("source_filename", original_filename),
            "text": source["text"],
            "created_at": now,
        })

    if chunk_docs:
        await chunks_col.insert_many(chunk_docs)

    chunk_count = int(document.get("chunk_count") or len(chunk_docs))
    job_doc = {
        "_id": job_id,
        "user_id": user["uid"],
        "status": "chunked",
        "fields": field_list,
        "task_prompt": body.task_prompt,
        "confidence_threshold": body.confidence_threshold,
        "output_format": body.output_format,
        "examples": [],
        "files": [{
            "filename": original_filename,
            "file_path": document.get("file_path"),
            "source_type": document.get("file_type"),
            "chunk_count": chunk_count,
            "file_size": document.get("file_size"),
            "source_job_id": source_job_id,
        }],
        "created_at": now,
        "updated_at": now,
    }
    await jobs_col.insert_one(job_doc)
    from app.routers.generation import run_generation_for_job
    background_tasks.add_task(run_generation_for_job, job_id, user["uid"])
    print(f"[create_job_from_document] scheduled generation job_id={job_id}")

    return {
        "job_id": job_id,
        "status": "chunked",
        "files_processed": 1,
        "files_failed": 0,
        "total_chunks": len(chunk_docs),
        "fields": field_list,
        "task_prompt": body.task_prompt,
        "confidence_threshold": body.confidence_threshold,
        "errors": None,
        "first_chunk": {
            "chunk_id": chunk_docs[0]["_id"],
            "text": chunk_docs[0]["text"],
            "word_count": len(chunk_docs[0]["text"].split()),
        } if chunk_docs else None,
    }


@router.get("/")
async def list_jobs(user: dict = Depends(get_current_user)):
    cursor = jobs_col.find({"user_id": user["uid"]}).sort("created_at", -1)
    jobs = await cursor.to_list(length=200)

    async def get_counts(job):
        job_id = str(job["_id"])
        chunk_count = await chunks_col.count_documents({"job_id": job_id})
        pair_count = await results_col.count_documents({"job_id": job_id, "approved": True, "discarded": {"$ne": True}})
        pending_count = await results_col.count_documents({"job_id": job_id, "approved": False, "discarded": {"$ne": True}})
        example_count = len(job.get("examples", []))
        return chunk_count, pair_count, pending_count, example_count

    tasks = [get_counts(job) for job in jobs]
    counts_results = await asyncio.gather(*tasks)

    enriched_jobs = []
    total_pairs = 0
    in_review = 0
    completed = 0

    for i, job in enumerate(jobs):
        chunk_count, pair_count, pending_count, example_count = counts_results[i]
        total_pairs += pair_count
        if job.get("status") == "review":
            in_review += 1
        elif job.get("status") == "done":
            completed += 1

        files = job.get("files", [])
        if files:
            primary_filename = files[0].get("filename")
        else:
            primary_filename = job.get("source_filename")

        enriched_jobs.append({
            "_id": str(job["_id"]),
            "status": job.get("status"),
            "created_at": job.get("created_at"),
            "chunk_count": chunk_count,
            "pair_count": pair_count,
            "pending_count": pending_count,
            "example_count": example_count,
            "primary_filename": primary_filename,
            "fields": job.get("fields", []),
            "files": job.get("files", []),
        })

    stats = {
        "total_jobs": len(jobs),
        "total_pairs": total_pairs,
        "in_review": in_review,
        "completed": completed,
    }

    return {"jobs": enriched_jobs, "stats": stats}


@router.get("/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    job["_id"] = str(job["_id"])
    job.setdefault("examples", [])
    job["chunk_count"] = await chunks_col.count_documents({"job_id": job_id})
    return job


@router.get("/{job_id}/chunks")
async def get_chunks(job_id: str, skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)

    total = await chunks_col.count_documents({"job_id": job_id})
    cursor = chunks_col.find(
        {"job_id": job_id}
    ).sort("chunk_index", 1).skip(skip).limit(limit)

    chunks = await cursor.to_list(length=limit)
    for c in chunks:
        c["_id"] = str(c["_id"])
        c["word_count"] = len(c["text"].split())

    return {
        "job_id": job_id,
        "total": total,
        "skip": skip,
        "limit": limit,
        "chunks": chunks,
    }


@router.delete("/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)

    await results_col.delete_many({"job_id": job_id})
    await chunks_col.delete_many({"job_id": job_id})
    await jobs_col.delete_one({"_id": job_id})

    for file_info in job.get("files", []):
        file_path = file_info.get("file_path")
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

    return {"deleted": job_id}
