"""Models for patch generation and management."""
from __future__ import annotations

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class PatchStatus(str, enum.Enum):
    active = "active"
    applied = "applied"
    conflicted = "conflicted"
    deprecated = "deprecated"
    archived = "archived"


class Patch(Base):
    """A custom patch that applies local changes on top of upstream code."""
    __tablename__ = "patches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    target_branch = Column(String, default="main")
    source_commit = Column(String)
    status = Column(Enum(PatchStatus), default=PatchStatus.active)
    content = Column(Text, nullable=False)  # The actual diff/patch content
    upstream_sha = Column(String)  # The upstream commit SHA this patch was based on
    hash = Column(String, unique=True)  # Content hash for deduplication
    applies_cleanly = Column(Boolean, default=True)
    conflict_details = Column(JSON, default={})
    priority = Column(Integer, default=0)
    tags = Column(JSON, default=[])
    applied_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PatchFile(Base):
    """Individual file within a patch."""
    __tablename__ = "patch_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patch_id = Column(UUID(as_uuid=True), ForeignKey("patches.id"), nullable=False)
    file_path = Column(String, nullable=False)
    change_type = Column(String, default="modified")  # added, modified, deleted
    diff_content = Column(Text, nullable=False)
    old_content_hash = Column(String)
    new_content_hash = Column(String)
    line_count = Column(Integer, default=0)


class PatchApplication(Base):
    """History of patch applications and their results."""
    __tablename__ = "patch_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patch_id = Column(UUID(as_uuid=True), ForeignKey("patches.id"), nullable=False)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=True)
    status = Column(String, default="pending")  # pending, applied, conflicted, failed
    applied_sha = Column(String)  # The merge commit SHA
    conflict_file_count = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    error_message = Column(Text)
    applied_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
