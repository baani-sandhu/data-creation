from fastapi import FastAPI, APIRouter
from app.utils.authService import register_user
from app.routes.schemas.authSchema import RegisterRequest


router=APIRouter(prefix="/admin")
@router.post("/create-admin", dependencies=[Depends(require_roles(["super"]))])
async def create_new_admin(admin_data: admin):
    return {"message": "Admin created successfully"}

@router.post("/register")
async def register(data: RegisterRequest):
    user = await register_user(data)
    return {
        "message": "User created",
        "user_id": str(user["_id"]),
    }
