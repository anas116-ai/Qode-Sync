from sqlalchemy import Column, String, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class AuditAction(str, enum.Enum):
    login = "login"
    logout = "logout"
    token_refresh = "token_refresh"
    repository_sync = "repository_sync"
    update_acknowledged = "update_acknowledged"
    notification_sent = "notification_sent"
    webhook_received = "webhook_received"

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    resource_type = Column(String)
    resource_id = Column(UUID(as_uuid=True))
    details = Column(JSON, default={})
    ip_address = Column(String)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())