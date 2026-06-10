"""Models for automated testing pipeline and coverage reporting."""
from __future__ import annotations

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class TestRunStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    running = "running"
    passed = "passed"
    failed = "failed"
    cancelled = "cancelled"
    timeout = "timeout"


class TestFramework(str, enum.Enum):
    pytest = "pytest"
    jest = "jest"
    mocha = "mocha"
    go_test = "go_test"
    cargo_test = "cargo_test"
    rspec = "rspec"
    phpunit = "phpunit"
    junit = "junit"
    custom = "custom"


class TestPipeline(Base):
    """Test pipeline configuration for a repository."""
    __tablename__ = "test_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    name = Column(String, nullable=False)
    framework = Column(Enum(TestFramework), default=TestFramework.custom)
    command = Column(String, nullable=False)
    working_directory = Column(String, default=".")
    timeout_seconds = Column(Integer, default=300)
    run_on_sync = Column(Boolean, default=True)
    run_on_merge = Column(Boolean, default=True)
    required_to_pass = Column(Boolean, default=True)  # Block merge if fails
    collect_coverage = Column(Boolean, default=True)
    coverage_threshold = Column(Float, default=80.0)
    environment_vars = Column(JSON, default={})
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TestRun(Base):
    """Individual test run execution record."""
    __tablename__ = "test_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("test_pipelines.id"), nullable=False)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    status = Column(Enum(TestRunStatus), default=TestRunStatus.pending)
    commit_sha = Column(String)
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    skipped_tests = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    coverage_percent = Column(Float)
    coverage_report = Column(JSON, default={})
    output_log = Column(Text)
    error_message = Column(Text)
    triggered_by = Column(String, default="auto")  # auto, manual, sync, merge
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TestFlakyDetection(Base):
    """Tracks flaky test detection across multiple runs."""
    __tablename__ = "test_flaky_detections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("test_pipelines.id"), nullable=False)
    test_name = Column(String, nullable=False)
    file_path = Column(String)
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    flaky_score = Column(Float, default=0.0)
    last_flaky_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
