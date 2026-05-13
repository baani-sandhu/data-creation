from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pymongo import UpdateOne
from pymongo.errors import OperationFailure
from app.services.pair_hash import compute_pair_hash

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(MONGO_URI)
db = client["labelforge"]

jobs_col   = db["jobs"]
chunks_col = db["chunks"]
results_col  = db["results"]
documents_col = db["documents"]
datasets_col = db["datasets"]
api_keys_col = db["api_keys"]
augmentation_runs_col = db["augmentation_runs"]

async def create_indexes():
    async def safe_create_index(collection, keys, **kwargs):
        try:
            await collection.create_index(keys, **kwargs)
        except OperationFailure as exc:
            # Existing environments can already have the same index name
            # with slightly different options (e.g., sparse vs non-sparse).
            # In that case we keep the existing index and continue startup.
            if getattr(exc, "code", None) == 86:
                return
            raise

    # chunks collection - most queried by job_id
    await safe_create_index(chunks_col, "job_id")
    await safe_create_index(chunks_col, [("job_id", 1), ("chunk_index", 1)])

    # results collection - queried by job_id + various filters
    await safe_create_index(results_col, "job_id")
    await safe_create_index(results_col, [("job_id", 1), ("approved", 1)])
    await safe_create_index(results_col, [("job_id", 1), ("source", 1)])
    await safe_create_index(results_col, [("job_id", 1), ("discarded", 1)])
    await safe_create_index(
        results_col,
        [("job_id", 1), ("source", 1), ("approved", 1), ("discarded", 1)]
    )
    await safe_create_index(results_col, [("job_id", 1), ("run_number", -1)])
    await safe_create_index(results_col, [("job_id", 1), ("pair_hash", 1)])
    await safe_create_index(results_col, [("job_id", 1), ("augmentation_cycle", 1), ("source", 1)])

    # jobs collection
    await safe_create_index(jobs_col, "user_id")
    await safe_create_index(jobs_col, [("user_id", 1), ("created_at", -1)])

    # documents collection
    await safe_create_index(documents_col, "user_id")
    await safe_create_index(documents_col, [("user_id", 1), ("original_filename", 1)])

    # datasets collection
    await safe_create_index(datasets_col, "user_id")
    await safe_create_index(datasets_col, [("user_id", 1), ("job_id", 1)])

    # augmentation jobs/runs collection
    await safe_create_index(augmentation_runs_col, "augmentation_run_id", unique=True)
    await safe_create_index(augmentation_runs_col, "augmentation_job_id", unique=True, sparse=True)
    await safe_create_index(augmentation_runs_col, "job_id")
    await safe_create_index(augmentation_runs_col, [("job_id", 1), ("created_at", -1)])
    await safe_create_index(augmentation_runs_col, "status")
    await safe_create_index(augmentation_runs_col, "mode")

    # api_keys collection
    await safe_create_index(api_keys_col, "user_id")

    await backfill_pair_hashes()


async def backfill_pair_hashes(batch_size: int = 500):
    cursor = results_col.find(
        {
            "pair": {"$type": "object"},
            "$or": [
                {"pair_hash": {"$exists": False}},
                {"pair_hash": None},
                {"pair_hash": ""},
            ],
        },
        projection={"_id": 1, "pair": 1},
    )

    updates: list[UpdateOne] = []
    async for doc in cursor:
        pair = doc.get("pair")
        if not isinstance(pair, dict):
            continue
        updates.append(
            UpdateOne(
                {"_id": doc["_id"]},
                {"$set": {"pair_hash": compute_pair_hash(pair)}},
            )
        )
        if len(updates) >= batch_size:
            await results_col.bulk_write(updates, ordered=False)
            updates = []

    if updates:
        await results_col.bulk_write(updates, ordered=False)
