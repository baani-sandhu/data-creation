from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum
from datetime import datetime

class ProjectStatus(str, Enum):
    draft='draft'
    completed='completed'
    configured='configured'
    training='training'
    failed='failed'

class ProjectBase(BaseModel):
    name:str = Field(...,min_length=3,max_length=100)
    description: Optional[str] = Field(None,max_length=500)
    base_model_id: Optional[str] = None

class CreateProject(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    dataset_id: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    status: Optional[ProjectStatus] = None

class ProjectInDB(ProjectBase):
    user_id: str
    dataset_id: Optional[str] = None
    status: ProjectStatus = ProjectStatus.draft
    configuration: Optional[Dict[str, Any]] = None
    training_job_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    
class ProjectResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    description: Optional[str]
    status: ProjectStatus
    base_model_id: Optional[str]
    dataset_id: Optional[str]
    metrics: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }