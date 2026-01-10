from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL= os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_USER= os.getenv("USER_COLLECTION")
client= AsyncIOMotorClient(MONGO_URL)
db=client[DB_NAME]

user_collection = db[COLLECTION_USER]