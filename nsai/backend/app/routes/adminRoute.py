from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.authMiddleware import get_current_user, require_roles
from app.routes.schemas.authSchema import RegisterRequest
from app.utils.authService import register_user, get_managed_team, delete_managed_user

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

@router.get("/my-team")
async def get_my_team(
    current_user = Depends(get_current_user)
):
    # Only super and admin should be allowed to hit this
    if current_user["role"] not in ["super", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied"
        )

    team_data = await get_managed_team(
        user_id=current_user["user_id"], 
        role=current_user["role"]
    )
    
    return team_data


@router.delete("/delete-user/{target_id}")
async def delete_user(
    target_id: str, 
    current_user = Depends(get_current_user)
):
    if current_user["role"] not in ["super", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    return await delete_managed_user(
        target_id=target_id,
        creator_id=current_user["user_id"],
        creator_role=current_user["role"]
    )