from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


AugmentationRunStatus = Literal["running", "completed", "partial", "failed"]


class AugmentationRun(BaseModel):
    augmentation_run_id: str = Field(..., min_length=1)
    job_id: str = Field(..., min_length=1)
    target_size: int = Field(..., ge=0)
    gap: int = Field(..., ge=0)
    mode1_quota: int = Field(..., ge=0)
    mode2_quota: int = Field(..., ge=0)
    mode1_generated: int = Field(default=0, ge=0)
    mode2_generated: int = Field(default=0, ge=0)
    status: AugmentationRunStatus
    shortfall_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
