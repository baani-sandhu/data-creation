from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class Admin(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr 
    username: str 
    password_hash: str
    first_name: str
    last_name: str
    role: str = "super"
    managed_admins: List[str] = [] # Admins managed by this superadmin
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)