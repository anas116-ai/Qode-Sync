from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class TokenStatus(str, enum.Enum):
    valid = "valid"
    invalid = "invalid"
    expired = "expired"
    revoked = "revoked"

class NotificationFrequency(str, enum.Enum):
    instant = "instant"
    hourly = "hourly"
    daily = "daily"
    weekly = "weekly"

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    username = Column(String, unique=True, nullable=False)
    display_name = Column(String)
    avatar_url = Column(String)
    email = Column(String)
    github_pat_encrypted = Column(Text)
    github_id = Column(Integer)
    token_status = Column(Enum(TokenStatus), default=TokenStatus.valid)
    token_last_validated = Column(DateTime(timezone=True))
    timezone = Column(String, default="UTC")
    language = Column(String, default="en")
    max_repositories = Column(Integer, default=500)
    email_notifications_enabled = Column(Boolean, default=True)
    notification_frequency = Column(Enum(NotificationFrequency), default=NotificationFrequency.instant)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_sync_at = Column(DateTime(timezone=True))

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "supabase_id": str(self.supabase_id) if self.supabase_id else None,
            "username": self.username,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "email": self.email,
            "github_id": self.github_id,
            "token_status": self.token_status.value if self.token_status else "valid",
            "token_last_validated": self.token_last_validated.isoformat() if self.token_last_validated else None,
            "timezone": self.timezone,
            "language": self.language,
            "max_repositories": self.max_repositories,
            "email_notifications_enabled": self.email_notifications_enabled,
            "notification_frequency": self.notification_frequency.value if self.notification_frequency else "instant",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
        }