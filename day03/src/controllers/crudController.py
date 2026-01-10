from config.database import user_collection
from controllers.authController import hash_password
from bson import ObjectId

async def create_user(user):
    user_dict={
        "email":user.email,
        "hashed_password": hash_password(user.password)
    }
    result = await user_collection.insert_one(user_dict)
    return str(result.inserted_id)

async def get_users():
    users= []
    async for user in user_collection.find():
        users.append({
            "id": str(user["_id"]),
            "email": user["email"]
        })
    return users

async def get_user_by_email(email:str):
    return await user_collection.find_one({"email":email})

async def delete_user(user_id:str):
    return await user_collection.delete_one({"_id":ObjectId(user_id)})