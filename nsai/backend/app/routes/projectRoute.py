from fastapi import APIRouter, Depends, status
from typing import Dict, Any
from app.routes.schemas.projectSchema import ProjectCreate, ProjectUpdate
from app.middleware.authMiddleware import get_current_user
from app.utils.projectService import (
    create_new_project,
    get_all_user_projects,
    get_project_by_id,
    update_project_by_id,
    delete_project_by_id
    ) 

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/", status_code=status.HTTP_201_CREATED , response_model=Dict[str, Any])
async def create_project(project_data: ProjectCreate, current_user = Depends(get_current_user)):
    project = await create_new_project(current_user["_id"], project_data)
    return project

@router.get("/", status_code=status.HTTP_200_OK)
async def list_projects(page: int = 1, limit: int = 10, current_user = Depends(get_current_user)):
    """
    Retrieve all projects managed by the authenticated user.
    """
    projects = await get_all_user_projects(current_user["_id"], page=page, limit=limit)
    return projects

@router.get("/{project_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_project(project_id: str, current_user = Depends(get_current_user)):
    """
    Fetch specific project details including metrics and status.
    """
    return await get_project_by_id(current_user["_id"], project_id)

@router.patch("/{project_id}", status_code=status.HTTP_200_OK)
async def update_project(project_id: str, data: ProjectUpdate, current_user = Depends(get_current_user)):
    """
    Update project metadata, status, or training configurations.
    """
    return await update_project_by_id(current_user["_id"], project_id, data)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, current_user = Depends(get_current_user)):
    """
    Remove the project from the MongoDB collection.
    """
    return await delete_project_by_id(current_user["_id"], project_id)