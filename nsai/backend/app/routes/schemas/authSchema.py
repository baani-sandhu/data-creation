from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: str
    last_name: str
    role: str #user or admin

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    user_id: str
    role: str