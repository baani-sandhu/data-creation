from fastapi import APIRouter, HTTPException, Depends
from app.database import jobs_col, examples_col
from pydantic import BaseModel
from datetime import datetime, timezone
from app.auth import get_current_user, get_owned_job
import uuid

router = APIRouter(prefix="/jobs", tags=["examples"])

# what one field assignment looks like
# e.g. {"field": "input", "text": "how do I reset my password"}
class FieldValue(BaseModel):
    field: str
    text: str

# one complete pair
# e.g. [
#   {"field": "input",  "text": "how do I reset my password"},
#   {"field": "output", "text": "go to settings and click forgot password"}
# ]
class ExampleCreate(BaseModel):
    chunk_id: str
    chunk_index: int
    source_filename: str
    pairs: list[FieldValue]   # one entry per field

class ExampleBulkCreate(BaseModel):
    examples: list[ExampleCreate]

@router.post("/{job_id}/examples")
async def save_examples(job_id: str, body: ExampleBulkCreate, user: dict = Depends(get_current_user)):
    # verify job exists
    job = await get_owned_job(job_id, user)

    if not body.examples:
        raise HTTPException(400, "No examples provided")

    # validate that all fields exist in the job definition
    valid_fields = set(job["fields"])
    for example in body.examples:
        for pair in example.pairs:
            if pair.field not in valid_fields:
                raise HTTPException(
                    400,
                    f"Field '{pair.field}' not defined in this job. "
                    f"Valid fields: {list(valid_fields)}"
                )
        # check all required fields are present in each example
        provided_fields = {p.field for p in example.pairs}
        missing = valid_fields - provided_fields
        if missing:
            raise HTTPException(
                400,
                f"Example is missing fields: {list(missing)}"
            )

    now = datetime.now(timezone.utc)

    # build documents
    example_docs = []
    for example in body.examples:
        # store as a clean dict: {"input": "...", "output": "..."}
        pair_dict = {p.field: p.text for p in example.pairs}

        example_docs.append({
            "_id": str(uuid.uuid4()),
            "job_id": job_id,
            "user_id": user["uid"],
            "chunk_id": example.chunk_id,
            "chunk_index": example.chunk_index,
            "source_filename": example.source_filename,
            "pair": pair_dict,       # the actual training pair
            "source": "human",       # human vs model vs feedback
            "created_at": now,
        })

    await examples_col.insert_many(example_docs)

    # update job status to labeling
    await jobs_col.update_one(
        {"_id": job_id, "user_id": user["uid"]},
        {"$set": {
            "status": "labeling",
            "updated_at": now,
        }}
    )

    return {
        "saved": len(example_docs),
        "job_id": job_id,
        "examples": [
            {
                "id": doc["_id"],
                "pair": doc["pair"],
                "chunk_index": doc["chunk_index"],
                "source_filename": doc["source_filename"],
            }
            for doc in example_docs
        ]
    }

@router.get("/{job_id}/examples")
async def get_examples(job_id: str, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)

    cursor = examples_col.find(
        {"job_id": job_id, "user_id": user["uid"]}
    ).sort("created_at", 1)

    examples = await cursor.to_list(length=500)
    for e in examples:
        e["_id"] = str(e["_id"])

    return {
        "job_id": job_id,
        "total": len(examples),
        "examples": examples,
    }

@router.delete("/{job_id}/examples/{example_id}")
async def delete_example(job_id: str, example_id: str, user: dict = Depends(get_current_user)):
    await get_owned_job(job_id, user)
    result = await examples_col.delete_one({
        "_id": example_id,
        "job_id": job_id,
        "user_id": user["uid"],
    })
    if result.deleted_count == 0:
        raise HTTPException(404, "Example not found")
    return {"deleted": example_id}
