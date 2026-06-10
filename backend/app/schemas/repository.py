from pydantic import BaseModel
from app.models.repository import SyncStatus
from app.models.update import UpdateSeverity
from datetime import datetime
import uuid
from typing import Optional, List, Any

class RepositoryBase(BaseModel):
    name: str
    full_name: str
    owner: str
    description: Optional[str] = None
    language: Optional[str] = None
    is_fork: bool = False
    archived: bool = False
    default_branch: str = "main"
    stars_count: int = 0
    forks_count: int = 0
    open_issues_count: int = 0

class RepositoryCreate(RepositoryBase):
    github_id: int
    parent_github_id: Optional[int] = None
    parent_full_name: Optional[str] = None
    parent_owner: Optional[str] = None

class RepositoryUpdate(BaseModel):
    is_watched: Optional[bool] = None
    is_bookmarked: Optional[bool] = None
    category: Optional[str] = None
    custom_labels: Optional[List[str]] = None

class RepositoryResponse(RepositoryBase):
    id: uuid.UUID
    sync_status: SyncStatus
    ahead_count: int
    behind_count: int
    divergence_count: int
    is_watched: bool
    is_bookmarked: bool
    category: Optional[str] = None
    custom_labels: List[Any]
    health_score: float
    risk_score: float
    last_commit_at: Optional[datetime] = None
    last_release_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    parent_full_name: Optional[str] = None

    class Config:
        from_attributes = True