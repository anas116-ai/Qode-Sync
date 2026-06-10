from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Enum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum

class NotificationChannel(str, enum.Enum):
    email = "email"
    slack = "slack"
    discord = "discord"
    telegram = "telegram"
    teams = "teams"
    webhook = "webhook"

class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    read = "read"

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    update_id = Column(UUID(as_uuid=True), ForeignKey("updates.id"), nullable=True)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("repositories.id"), nullable=True)
    channel = Column(Enum(NotificationChannel), default=NotificationChannel.email)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String, default="pending")
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True))

class NotificationRule(Base):
    __tablename__ = "notification_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    channel = Column(String, nullable=False)
    frequency = Column(String, default="instant")
    min_severity = Column(String, default="medium")
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default={})

class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False)
    channel = Column(String, nullable=False)
    status = Column(String, default="pending")
    response = Column(Text)
    delivered_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())