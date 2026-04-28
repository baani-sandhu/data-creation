from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pymongo import UpdateOne
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
    # chunks collection - most queried by job_id
    await chunks_col.create_index("job_id")
    await chunks_col.create_index([("job_id", 1), ("chunk_index", 1)])

    # results collection - queried by job_id + various filters
    await results_col.create_index("job_id")
    await results_col.create_index([("job_id", 1), ("approved", 1)])
    await results_col.create_index([("job_id", 1), ("source", 1)])
    await results_col.create_index([("job_id", 1), ("discarded", 1)])
    await results_col.create_index(
        [("job_id", 1), ("source", 1), ("approved", 1), ("discarded", 1)]
    )
    await results_col.create_index([("job_id", 1), ("run_number", -1)])
    await results_col.create_index([("job_id", 1), ("pair_hash", 1)])

    # jobs collection
    await jobs_col.create_index("user_id")
    await jobs_col.create_index([("user_id", 1), ("created_at", -1)])

    # documents collection
    await documents_col.create_index("user_id")
    await documents_col.create_index([("user_id", 1), ("original_filename", 1)])

    # datasets collection
    await datasets_col.create_index("user_id")
    await datasets_col.create_index([("user_id", 1), ("job_id", 1)])

    # augmentation runs collection
    await augmentation_runs_col.create_index("augmentation_run_id", unique=True)
    await augmentation_runs_col.create_index("job_id")
    await augmentation_runs_col.create_index([("job_id", 1), ("created_at", -1)])
    await augmentation_runs_col.create_index("status")

    # api_keys collection
    await api_keys_col.create_index("user_id")

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
