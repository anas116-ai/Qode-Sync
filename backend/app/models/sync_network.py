"""Models for federated sync network between multiple forks."""
from __future__ import annotations

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class NetworkStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    error = "error"
    archived = "archived"


class SyncNetwork(Base):
    """A federated network of forks that sync together."""
    __tablename__ = "sync_networks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(NetworkStatus), default=NetworkStatus.active)
    sync_frequency = Column(String, default="daily")  # hourly, daily, weekly, manual
    conflict_strategy = Column(String, default="auto_ai")  # auto_ai, manual, upstream_priority, fork_priority
    auto_discover = Column(Boolean, default=True)
    notify_on_sync = Column(Boolean, default=True)
    notify_on_conflict = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SyncNetworkNode(Base):
    """A fork participating in a sync network."""
    __tablename__ = "sync_network_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    network_id = Column(UUID(as_uuid=True), ForeignKey("sync_networks.id"), nullable=False)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    is_upstream = Column(Boolean, default=False)
    sync_enabled = Column(Boolean, default=True)
    auto_merge = Column(Boolean, default=True)
    sync_order = Column(Integer, default=0)
    last_sync_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SyncNetworkEvent(Base):
    """Event log for sync network activities."""
    __tablename__ = "sync_network_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    network_id = Column(UUID(as_uuid=True), ForeignKey("sync_networks.id"), nullable=False)
    event_type = Column(String, nullable=False)  # sync_started, sync_completed, conflict, error, node_added, node_removed
    source_repo_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=True)
    target_repo_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=True)
    merge_job_id = Column(UUID(as_uuid=True), ForeignKey("merge_jobs.id"), nullable=True)
    details = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
