from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class SyncJobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class SyncType(str, enum.Enum):
    full = "full"
    incremental = "incremental"
    ondemand = "ondemand"

class SyncJob(Base):
    __tablename__ = "sync_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    job_type = Column(String, nullable=False)
    status = Column(Enum(SyncJobStatus), default=SyncJobStatus.pending)
    total_repos = Column(Integer, default=0)
    processed_repos = Column(Integer, default=0)
    successful_repos = Column(Integer, default=0)
    failed_repos = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sync_job_id = Column(UUID(as_uuid=True), ForeignKey("sync_jobs.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=True)
    level = Column(String, default="info")
    message = Column(Text, nullable=False)
    details = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())