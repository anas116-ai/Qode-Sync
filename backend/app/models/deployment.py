"""Models for GitOps deployment automation and sync-triggered deployments."""
from __future__ import annotations

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class DeploymentProvider(str, enum.Enum):
    kubernetes = "kubernetes"
    docker = "docker"
    cloud_run = "cloud_run"
    ecs = "ecs"
    ec2 = "ec2"
    lambda_ = "lambda"
    heroku = "heroku"
    vercel = "vercel"
    netlify = "netlify"
    custom = "custom"


class DeploymentStatus(str, enum.Enum):
    pending = "pending"
    building = "building"
    deploying = "deploying"
    healthy = "healthy"
    failed = "failed"
    rolled_back = "rolled_back"


class DeploymentConfig(Base):
    """Configuration for deployment targets."""
    __tablename__ = "deployment_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    name = Column(String, nullable=False)
    provider = Column(Enum(DeploymentProvider), nullable=False)
    target_branch = Column(String, default="main")
    auto_deploy = Column(Boolean, default=False)
    deploy_on_sync = Column(Boolean, default=False)
    environment = Column(String, default="production")  # production, staging, development
    config = Column(JSON, default={})  # Provider-specific config
    credentials_ref = Column(String)  # Reference to stored credentials
    health_check_endpoint = Column(String)
    rollback_on_failure = Column(Boolean, default=True)
    max_retries = Column(Integer, default=3)
    notify_on_success = Column(Boolean, default=True)
    notify_on_failure = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)
    last_deployed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Deployment(Base):
    """Individual deployment record."""
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_id = Column(UUID(as_uuid=True), ForeignKey("deployment_configs.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=True)
    version = Column(String)
    status = Column(Enum(DeploymentStatus), default=DeploymentStatus.pending)
    commit_sha = Column(String)
    rollout_percentage = Column(Integer, default=100)
    duration_ms = Column(Integer)
    logs = Column(JSON, default=[])
    error_message = Column(Text)
    rollback_deployment_id = Column(UUID(as_uuid=True))
    external_url = Column(String)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
