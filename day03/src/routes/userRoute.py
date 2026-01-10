from fastapi import HTTPException, APIRouter, Depends

from models.user_schema import UserCreate, UserResponse
from controllers.crudController import create_user, get_users, delete_user
from controllers.authController import get_current_user

router=APIRouter(prefix="/users",tags=["users"])

@router.post("/",response_model=UserCreate)
async def create(User:UserCreate):
    user_id=await create_user(User)
    return {"id":user_id, "email":User.email}

@router.get("/",response_model=list[UserCreate])
async def read_user(current_user:str=Depends(get_current_user)):
    return await get_users()

@router.delete("/{user_id}")
async def remove_user(user_id:str, current_user:str=Depends(get_current_user)):
    await delete_user(user_id)
    return {"delted":user_id}
