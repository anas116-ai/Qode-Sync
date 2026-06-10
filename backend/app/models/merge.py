"""Models for auto-merge, risk assessment, dependency conflict resolution, and merge tracking."""
from __future__ import annotations

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class MergeStatus(str, enum.Enum):
    pending = "pending"
    risk_assessing = "risk_assessing"
    approved = "approved"
    blocked = "blocked"
    merging = "merging"
    completed = "completed"
    failed = "failed"
    conflict = "conflict"
    rolled_back = "rolled_back"


class RiskLevel(str, enum.Enum):
    safe = "safe"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

    def value_weight(self) -> float:
        weights = {
            "safe": 0.0,
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0,
        }
        return weights.get(self.value, 0.5)


class MergeJob(Base):
    """Tracks an individual auto-merge operation for a forked repository."""
    __tablename__ = "merge_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    status = Column(Enum(MergeStatus), default=MergeStatus.pending, nullable=False)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.medium)
    risk_assessment = Column(JSON, default={})
    base_branch = Column(String, default="main")
    head_branch = Column(String, default="main")
    merge_commit_sha = Column(String)
    ahead_commits = Column(Integer, default=0)
    behind_commits = Column(Integer, default=0)
    conflict_files = Column(ARRAY(String), default=[])
    auto_resolved = Column(Boolean, default=False)
    breaking_changes_detected = Column(Boolean, default=False)
    breaking_changes_detail = Column(Text)
    rollback_commit_sha = Column(String)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MergeConflict(Base):
    """Tracks individual file conflicts during a merge."""
    __tablename__ = "merge_conflicts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=False)
    file_path = Column(String, nullable=False)
    upstream_content = Column(Text)
    fork_content = Column(Text)
    resolved_content = Column(Text)
    resolution_strategy = Column(String)  # auto_ai, ours, theirs, manual
    auto_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))


class RiskAssessmentLog(Base):
    """Detailed AI risk assessment log for each merge."""
    __tablename__ = "risk_assessment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=False)
    assessment_type = Column(String, nullable=False)  # breaking_changes, dependency_conflicts, api_compat, test_impact
    score = Column(Float, default=0.0)
    summary = Column(Text)
    details = Column(JSON, default={})
    ai_model = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DependencyConflict(Base):
    """Tracks dependency conflicts detected during merge analysis."""
    __tablename__ = "dependency_conflicts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=True)
    package_name = Column(String, nullable=False)
    package_manager = Column(String, nullable=False)  # npm, pip, cargo, go, maven, etc.
    upstream_version = Column(String)
    fork_version = Column(String)
    resolved_version = Column(String)
    conflict_type = Column(String, default="version_mismatch")  # version_mismatch, breaking, deprecation, security
    severity = Column(String, default="medium")
    auto_resolved = Column(Boolean, default=False)
    resolution_strategy = Column(String)  # use_upstream, use_fork, merge, bump_minor, bump_patch
    ai_recommendation = Column(Text)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
