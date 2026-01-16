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

    if requester_role == "admin":
        if target_role != "user":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Admins are only permitted to create standard Users."
            )
    
    elif requester_role == "super":
        if target_role not in ["admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Invalid role. Superadmins can create 'admin' or 'user'."
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