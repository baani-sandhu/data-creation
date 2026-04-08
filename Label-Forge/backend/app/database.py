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
