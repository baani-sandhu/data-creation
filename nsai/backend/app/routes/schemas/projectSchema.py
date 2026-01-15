from pydantic import BaseModel, Field
from typing import Optional, Dict
from enum import Enum


class ProjectStatus(str, Enum):
    draft = "draft"
    configured = "configured"
    training = "training"
    completed = "completed"
    failed = "failed"


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3)
    description: Optional[str] = None
    base_model_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    dataset_id: Optional[str]
    configuration: Optional[Dict]
    status: Optional[ProjectStatus]


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: ProjectStatus
