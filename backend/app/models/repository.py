from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class SyncStatus(str, enum.Enum):
    synced = "synced"
    behind = "behind"
    ahead = "ahead"
    diverged = "diverged"
    unknown = "unknown"

class Repository(Base):
    __tablename__ = "repositories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    github_id = Column(Integer, unique=True, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    owner = Column(String, nullable=False)
    description = Column(Text)
    language = Column(String)
    is_fork = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    default_branch = Column(String, default="main")
    stars_count = Column(Integer, default=0)
    forks_count = Column(Integer, default=0)
    open_issues_count = Column(Integer, default=0)
    parent_github_id = Column(Integer)
    parent_full_name = Column(String)
    parent_owner = Column(String)
    parent_default_branch = Column(String, default="main")
    sync_status = Column(Enum(SyncStatus), default=SyncStatus.unknown)
    ahead_count = Column(Integer, default=0)
    behind_count = Column(Integer, default=0)
    divergence_count = Column(Integer, default=0)
    is_watched = Column(Boolean, default=True)
    is_bookmarked = Column(Boolean, default=False)
    category = Column(String)
    custom_labels = Column(JSON, default=[])
    health_score = Column(Float, default=100.0)
    risk_score = Column(Float, default=0.0)
    last_commit_at = Column(DateTime(timezone=True))
    last_release_at = Column(DateTime(timezone=True))
    last_sync_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "github_id": self.github_id,
            "name": self.name,
            "full_name": self.full_name,
            "owner": self.owner,
            "description": self.description,
            "language": self.language,
            "is_fork": self.is_fork,
            "archived": self.archived,
            "default_branch": self.default_branch,
            "stars_count": self.stars_count,
            "forks_count": self.forks_count,
            "open_issues_count": self.open_issues_count,
            "parent_github_id": self.parent_github_id,
            "parent_full_name": self.parent_full_name,
            "parent_owner": self.parent_owner,
            "parent_default_branch": self.parent_default_branch,
            "sync_status": self.sync_status.value if self.sync_status else "unknown",
            "ahead_count": self.ahead_count,
            "behind_count": self.behind_count,
            "divergence_count": self.divergence_count,
            "is_watched": self.is_watched,
            "is_bookmarked": self.is_bookmarked,
            "category": self.category,
            "custom_labels": self.custom_labels or [],
            "health_score": self.health_score,
            "risk_score": self.risk_score,
            "last_commit_at": self.last_commit_at.isoformat() if self.last_commit_at else None,
            "last_release_at": self.last_release_at.isoformat() if self.last_release_at else None,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }