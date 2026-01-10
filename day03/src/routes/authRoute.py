from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from controllers.authController import verify_password, create_access_token, get_current_user
from models.user_schema import UserCreate, UserResponse
from controllers.crudController import get_user_by_email

router=APIRouter(tags=["authentication"])


@router.post("/login")
async def login()
@router.post("/token")
async def token(form_data:OAuth2PasswordRequestForm=Depends()):
    user=await get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password,user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid Credentials")
    
    token=create_access_token({"sub":user["email"]})
    return {"access token": token, "token_type":"bearer"}