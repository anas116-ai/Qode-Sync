from pydantic import BaseModel, EmailStr
from app.models.user import TokenStatus, NotificationFrequency
from datetime import datetime
import uuid
from typing import Optional

class UserProfileBase(BaseModel):
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[str] = None
    timezone: str = "UTC"
    language: str = "en"
    max_repositories: int = 500
    email_notifications_enabled: bool = True
    notification_frequency: NotificationFrequency = NotificationFrequency.instant

class UserProfileCreate(UserProfileBase):
    supabase_id: uuid.UUID
    github_pat_encrypted: Optional[str] = None
    github_id: Optional[int] = None

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    max_repositories: Optional[int] = None
    email_notifications_enabled: Optional[bool] = None
    notification_frequency: Optional[NotificationFrequency] = None

class UserProfileResponse(UserProfileBase):
    id: uuid.UUID
    github_id: Optional[int] = None
    token_status: TokenStatus
    token_last_validated: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True