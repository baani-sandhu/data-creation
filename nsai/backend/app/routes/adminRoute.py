from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.authMiddleware import get_current_user, require_roles
from app.routes.schemas.authSchema import RegisterRequest
from app.utils.authService import register_user

router = APIRouter(prefix="/admin", tags=["Admin Management"])

@router.post("/register-internal")
async def register_user_or_admin(
    payload: RegisterRequest, 
    current_user = Depends(get_current_user)
):

    requester_role = current_user.get("role")
    target_role = payload.role


    if requester_role == "super":
        # Superadmins can only create admins
        if target_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Superadmins can only create Admin accounts."
            )
    
    elif requester_role == "admin":
        # Admins can only create users
        if target_role != "user":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Admins are only permitted to create standard Users."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You do not have permission to register new accounts."
        )

    new_user_id = await register_user(
        data=payload, 
        creator_id=current_user["user_id"],
        creator_role=requester_role
    )

    return {
        "message": f"Successfully registered {target_role}",
        "id": new_user_id
    }