from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.MONGO_DB]

users_collection = db.users
projects_collection = db.projects
superadmin_collection = db.superadmin # Collection for superadmin users
