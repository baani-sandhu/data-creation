from fastapi import APIRouter, Depends
from fastapi_limiter.depends import RateLimiter

from app.routes.schemas.authSchema import RegisterRequest, LoginRequest
from app.middleware.authMiddleware import get_current_user
from app.utils.authService import register_user,login_user, refresh_access_token, logout_user
from app.routes.schemas.tokenSchema import RefreshTokenRequest

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def login(data: LoginRequest):
    return await login_user(data)

@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
    }

@router.post("/refresh")
async def refresh(data: RefreshTokenRequest):
    return await refresh_access_token(data.refresh_token)

@router.post("/logout")
async def logout(data: RefreshTokenRequest):
    return await logout_user(data.refresh_token)
