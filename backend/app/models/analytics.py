from sqlalchemy import Column, String, DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid

class Analytics(Base):
    __tablename__ = "analytics"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    repositories_updated = Column(Integer, default=0)
    updates_detected = Column(Integer, default=0)
    notifications_sent = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RepositoryStats(Base):
    __tablename__ = "repository_stats"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    commits_behind = Column(Integer, default=0)
    commits_ahead = Column(Integer, default=0)
    health_score = Column(Float, default=100.0)
    open_issues = Column(Integer, default=0)
    stars = Column(Integer, default=0)

class UserStats(Base):
    __tablename__ = "user_stats"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    total_forks = Column(Integer, default=0)
    updated_forks = Column(Integer, default=0)
    outdated_forks = Column(Integer, default=0)
    critical_updates = Column(Integer, default=0)
    last_calculated = Column(DateTime(timezone=True), server_default=func.now())