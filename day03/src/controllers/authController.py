from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv
load_dotenv()

SECRET_JWT = os.getenv("SECRET_JWT")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRY_TIME = os.getenv("EXPIRY")

pwd_context= CryptContext(schemes=["bcrypt"])
oauth2_scheme= OAuth2PasswordBearer(tokenUrl="token")

def hash_password(password:str):
    return pwd_context.hash(password)

def verify_password(password, hashed):
    return pwd_context.verify(password,hashed)

def create_access_token(data: dict):
    expire= datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRY_TIME)
    data.update({"exp":expire})
    return jwt.encode(data,SECRET_JWT,algorithm=ALGORITHM)

def get_current_user(token:str=Depends(oauth2_scheme)):
    try:
        payload= jwt.decode(token,SECRET_JWT,algorithms=ALGORITHM)
        return payload["sub"]
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_SENT"
        )