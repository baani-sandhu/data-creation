from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from app.database import results_col
from app.auth import get_current_user, get_owned_job
import json, csv, io

router = APIRouter(prefix="/jobs", tags=["export"])


async def _get_chunk_index_by_id(chunk_ids: list[str]) -> dict[str, int]:
    if not chunk_ids:
        return {}

    from app.database import chunks_col

    cursor = chunks_col.find({"_id": {"$in": chunk_ids}})
    chunks = await cursor.to_list(length=len(chunk_ids))
    return {chunk["_id"]: chunk.get("chunk_index", 0) for chunk in chunks}


@router.get("/{job_id}/export")
async def export_dataset(job_id: str, user: dict = Depends(get_current_user)):
    # load job to get output_format and fields
    job = await get_owned_job(job_id, user)

    output_format = job.get("output_format", "jsonl")
    fields = job["fields"]

    # fetch all approved, non-discarded results
    cursor = results_col.find({
        "job_id": job_id,
        "approved": True,
        "discarded": {"$ne": True}
    })
    results = await cursor.to_list(length=None)
    chunk_index_by_id = await _get_chunk_index_by_id([result["chunk_id"] for result in results])
    results.sort(key=lambda result: chunk_index_by_id.get(result["chunk_id"], 0))

    if not results:
        raise HTTPException(400, "No approved results to export")

    # extract only the pair fields in correct order
    pairs = []
    for r in results:
        pair = {field: r["pair"].get(field, "") for field in fields}
        pairs.append(pair)

    # convert to requested format
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
            quoting=csv.QUOTE_ALL
        )
        writer.writeheader()
        writer.writerows(pairs)
        content = output.getvalue()
        media_type = "text/csv"
        filename = f"labelforge_{job_id}.csv"

    else:
        raise HTTPException(400, f"Unknown format: {output_format}")

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Total-Pairs": str(len(pairs)),
        }
    )
