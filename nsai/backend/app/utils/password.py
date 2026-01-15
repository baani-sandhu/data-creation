from passlib.context import CryptContext
import re

pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto", )

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password,hashed)

def validate_password_strength(password: str):
    if len(password) < 8 or len(password) > 24:
        raise ValueError("Password too short or too long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain number")
    if not re.search(r"[!@#$%^&*()_+=-]", password):
        raise ValueError("Password must contain special character")

