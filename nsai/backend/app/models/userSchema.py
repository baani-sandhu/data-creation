from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    username: str
    password_hash: str
    first_name: str
    last_name: str
    role: str
    # attached_user: Optional[List]
    is_verified: bool = False # to be removed
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_login: Optional[datetime] = None # to be removed will use updated_at
    profile_image_url: Optional[str] = None # to be removed

