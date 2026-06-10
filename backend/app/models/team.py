from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class TeamRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    member = "member"
    viewer = "viewer"

class Team(Base):
    __tablename__ = "teams"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    role = Column(Enum(TeamRole), default=TeamRole.member)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"))
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text)
    avatar_url = Column(String)
    created_by = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())