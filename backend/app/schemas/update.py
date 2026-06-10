from pydantic import BaseModel
from app.models.update import UpdateType, UpdateStatus, UpdateSeverity
from datetime import datetime
import uuid
from typing import Optional, Any

class UpdateResponse(BaseModel):
    id: uuid.UUID
    update_type: UpdateType
    status: UpdateStatus
    severity: UpdateSeverity
    title: str
    description: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_summary_detailed: Optional[str] = None
    github_sha: Optional[str] = None
    github_url: Optional[str] = None
    author: Optional[str] = None
    files_changed: int
    additions: int
    deletions: int
    metadata: dict
    notified: bool
    created_at: datetime
    viewed_at: Optional[datetime] = None
    repository_id: uuid.UUID

    class Config:
        from_attributes = True

class UpdateCreate(BaseModel):
    repository_id: uuid.UUID
    update_type: UpdateType
    title: str
    description: Optional[str] = None
    severity: UpdateSeverity = UpdateSeverity.medium
    github_sha: Optional[str] = None
    github_url: Optional[str] = None
    author: Optional[str] = None
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    metadata: dict = {}