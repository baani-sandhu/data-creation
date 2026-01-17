from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class ProjectBase(BaseModel):
    name: str = Field(..., description="Project name")
    base_model: Optional[str] = Field(None, description="Hugging Face model ID")
    dataset_link: Optional[str] = Field(None, description="Reference to datasets")
    configuration: Optional[Dict[str, Any]] = Field(None, description="Training hyperparameters")


class ProjectCreate(ProjectBase):
    # Name is required for creation
    name: str 

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    base_model_id: Optional[str] = None
    dataset_id: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    training_job_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None