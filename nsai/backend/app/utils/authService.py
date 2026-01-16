from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException
from jose import JWTError

from app.config.db import users_collection, superadmin_collection
from app.utils.password import hash_password, verify_password, validate_password_strength
from pymongo.errors import DuplicateKeyError

from app.utils.jwt import create_access_token, create_refresh_token, decode_token
from app.utils.token_blacklist import is_token_blacklisted, blacklist_token

async def register_user(data, creator_id:str):
    validate_password_strength(data.password)
    existing = await users_collection.find_one(
        {"$or": [{"email": data.email}, {"username": data.username}]}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user = {
        "email": data.email,
        "username": data.username,
        "password_hash": hash_password(data.password),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "role": data.role,
        "managed_by": creator_id,
        "linked_users": [],
        "managed_super_admins": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }

    try:
        result = await users_collection.insert_one(user)
        update_field = "managed_super_admins" if data.role == "admin" else "linked_users"
        new_id = str(result.inserted_id)
        
        await users_collection.update_one(
        {"_id": ObjectId(creator_id)},
        {"$push": {update_field: new_id}}
        )
        return user
    
    except DuplicateKeyError as e:
        # prevents two users to create same user at once (prevents double clicking)
        raise HTTPException(
            status_code=400, 
            detail="Username or Email already taken"
        )


async def login_user(data):
    user=await superadmin_collection.find_one({email:data.email})
    target_collection= superadmin_collection

    if not user:
        user = await users_collection.find_one({"email": data.email})
        target_collection= users_collection
    
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await users_collection.update_one(
        {"_id": user["_id"]}, {"$set": {"updated_at": datetime.now()}}
    )

    access_token = create_access_token(str(user["_id"]), user["email"], user["role"])
    refresh_token = create_refresh_token(str(user["_id"]))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

async def refresh_access_token(refresh_token: str):
    try:
        payload = decode_token(refresh_token)
        token_id = payload.get("token_id")
        user_id = payload.get("user_id")
        role=payload.get("role")
        if not token_id or not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        if await is_token_blacklisted(token_id):
            raise HTTPException(status_code=401, detail="Token is revoked")

        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "access_token": create_access_token(
                str(user["_id"]), user["email"], user["role"]
            )
        }

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


async def logout_user(refresh_token: str):
    try:
        payload = decode_token(refresh_token)
        token_id = payload["token_id"]
        exp = payload["exp"]

        expires_in = exp - int(datetime.now().timestamp())
        await blacklist_token(token_id, expires_in)

        return {"message": "Logged out successfully"}

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
