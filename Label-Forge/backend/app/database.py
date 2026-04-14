from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

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

    # jobs collection
    await jobs_col.create_index("user_id")
    await jobs_col.create_index([("user_id", 1), ("created_at", -1)])

    # documents collection
    await documents_col.create_index("user_id")
    await documents_col.create_index([("user_id", 1), ("original_filename", 1)])

    # datasets collection
    await datasets_col.create_index("user_id")
    await datasets_col.create_index([("user_id", 1), ("job_id", 1)])

    # api_keys collection
    await api_keys_col.create_index("user_id")
