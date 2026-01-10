from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password:str = Field(min_length=8)

class UserResponse(BaseModel):
    id: str
    email: EmailStr

class UserInDB(UserResponse):
    hashed_password: str

