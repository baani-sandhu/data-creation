from fastapi import APIRouter, HTTPException, Depends
from app.database import jobs_col
from pydantic import BaseModel
from datetime import datetime, timezone
from app.auth import get_current_user, get_owned_job

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

    new_examples = []
    for example in body.examples:
        pair_dict = {p.field: p.text for p in example.pairs}
        new_examples.append(pair_dict)

    all_examples = job.get("examples", []) + new_examples

    await jobs_col.update_one(
        {"_id": job_id, "user_id": user["uid"]},
        {"$set": {
            "examples": all_examples,
            "status": "labeling",
            "updated_at": now,
        }}
    )

    return {
        "saved": len(new_examples),
        "job_id": job_id,
        "examples": new_examples,
    }

@router.get("/{job_id}/examples")
async def get_examples(job_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    examples = job.get("examples", [])

    return {
        "job_id": job_id,
        "total": len(examples),
        "examples": examples,
    }

@router.delete("/{job_id}/examples/{example_id}")
async def delete_example(job_id: str, example_id: str, user: dict = Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    examples = list(job.get("examples", []))

    try:
        example_index = int(example_id)
    except ValueError as exc:
        raise HTTPException(404, "Example not found") from exc

    if example_index < 0 or example_index >= len(examples):
        raise HTTPException(404, "Example not found")

    del examples[example_index]
    await jobs_col.update_one(
        {"_id": job_id, "user_id": user["uid"]},
        {"$set": {"examples": examples, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"deleted": example_id}
