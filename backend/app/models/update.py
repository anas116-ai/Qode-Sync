from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class UpdateType(str, enum.Enum):
    commit = "commit"
    release = "release"
    tag = "tag"
    security_advisory = "security_advisory"
    breaking_change = "breaking_change"
    pull_request_merged = "pull_request_merged"

class UpdateSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"

class UpdateStatus(str, enum.Enum):
    new = "new"
    viewed = "viewed"
    synced = "synced"
    ignored = "ignored"

class Update(Base):
    __tablename__ = "updates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    update_type = Column(Enum(UpdateType), nullable=False)
    status = Column(Enum(UpdateStatus), default=UpdateStatus.new)
    severity = Column(Enum(UpdateSeverity), default=UpdateSeverity.medium)
    title = Column(String, nullable=False)
    description = Column(Text)
    ai_summary = Column(Text)
    ai_summary_detailed = Column(Text)
    github_sha = Column(String)
    github_url = Column(String)
    author = Column(String)
    files_changed = Column(Integer, default=0)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    extra_metadata = Column("metadata", JSON, default={})
    notified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    viewed_at = Column(DateTime(timezone=True))

class UpdateCommit(Base):
    __tablename__ = "update_commits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    update_id = Column(UUID(as_uuid=True), ForeignKey("updates.id"), nullable=False)
    sha = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    author = Column(String)
    author_date = Column(DateTime(timezone=True))
    url = Column(String)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)

class UpdateRelease(Base):
    __tablename__ = "update_releases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    update_id = Column(UUID(as_uuid=True), ForeignKey("updates.id"), nullable=False)
    tag_name = Column(String, nullable=False)
    name = Column(String)
    body = Column(Text)
    prerelease = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True))
    github_url = Column(String)

class SecurityAdvisory(Base):
    __tablename__ = "security_advisories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    github_id = Column(String, unique=True, nullable=False)
    summary = Column(Text, nullable=False)
    description = Column(Text)
    severity = Column(String)
    cve_id = Column(String)
    published_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    github_url = Column(String)
    patched_version = Column(String)
    affected_versions = Column(ARRAY(String))