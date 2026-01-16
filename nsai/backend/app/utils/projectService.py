from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException 
from typing import Dict, Any
from pymongo.errors import DuplicateKeyError

from app.routes.schemas.projectSchema import ProjectCreate, ProjectUpdate
from app.config.db import projects_collection
from datetime import datetime

async def create_new_project(user_id: str, data: ProjectCreate) -> Dict[str, Any]:
    """Todo: Implement the
    Logic for the User Project Creation Flow.
    Inserts a new project document into the MongoDB collection
    """
    project = {
        "name": data.name,
        "user_id": ObjectId(user_id),
        "base_model": data.base_model or "default-model",
        "dataset_url": data.dataset_link or "",
        "metrics": {},
        "configuration": data.configuration or {},
        "training_job_ids": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }

    try:
        result = await projects_collection.insert_one(project)
        project["_id"] = str(result.inserted_id)
        project["user_id"] = str(project["user_id"])

        return project
    except DuplicateKeyError:
        raise HTTPException(
            status_code=400, 
            detail="A project with this configuration already exists."
        )
    

async def get_all_user_projects(user_id: str, page: int = 1, limit: int = 10):
    """Retrieves all projects for the logged-in user."""

    skip_count = (page - 1) * limit

    projects = await projects_collection.find({"user_id": user_id}).skip(skip_count).limit(limit).to_list(length=limit)

    total_count = await projects_collection.count_documents({"user_id": user_id})

    for project in projects:
        project["_id"] = str(project["_id"])

    return {
        "projects": projects,
        "total": total_count,
        "page": page,
        "limit": limit
    }



async def get_project_by_id(user_id: str, project_id: str):
    """Fetches a single project with ownership validation."""
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID format.")
    
    project = await projects_collection.find_one({
        "_id": ObjectId(project_id),
        "user_id": ObjectId(user_id) 
    })

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    
    project["_id"] = str(project["_id"])
    return project



async def update_project_by_id(user_id: str, project_id: str, data: ProjectUpdate):
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID format.")
    
    #Filter out None values to avoid overwriting existing fields with null
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now()  


    # Tell the database to update ONLY those specific pieces
    result = await projects_collection.find_one_and_update(
        {"_id": ObjectId(project_id), "user_id": user_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized user.")
    

    result["_id"] = str(result["_id"])
    return result


async def delete_project_by_id(user_id: str, project_id: str):
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID format.")
    
    result = await projects_collection.delete_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized user.")
    

    return {"message": "Project deleted successfully"}