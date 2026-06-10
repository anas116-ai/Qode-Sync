from pydantic import BaseModel
from datetime import datetime
import uuid
from typing import Optional

class NotificationBase(BaseModel):
    channel: str
    title: str
    body: str

class NotificationCreate(NotificationBase):
    user_id: uuid.UUID
    update_id: Optional[uuid.UUID] = None
    repository_id: Optional[uuid.UUID] = None

class NotificationResponse(NotificationBase):
    id: uuid.UUID
    status: str
    is_read: bool
    read_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationRuleCreate(BaseModel):
    channel: str
    frequency: str = "instant"
    min_severity: str = "medium"
    enabled: bool = True
    config: dict = {}