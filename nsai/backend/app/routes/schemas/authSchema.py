from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)

class RegisterRequest(UserBase):
    password: str
    role: str #user or admin

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    user_id: str
    role: str

class UserResponse(UserBase):
    id: str = Field(..., alias="_id")
    role: str
    managed_by: Optional[str] = None