"""Notification rule endpoints with multi-channel support."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.notification import Notification, NotificationRule
from app.core.notifications_providers import send_notification

router = APIRouter()


class NotificationRuleCreate(BaseModel):
    channel: str  # email, slack, discord, telegram, teams, webhook, web_push
    frequency: str = "instant"  # instant, hourly, daily, weekly
    min_severity: str = "medium"
    enabled: bool = True
    config: dict = {}


class TestSendRequest(BaseModel):
    channel: str
    destination: str
    subject: str
    body: str


@router.post("/rules/create")
async def create_rule(
    payload: NotificationRuleCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = NotificationRule(
        user_id=current_user.id,
        channel=payload.channel,
        frequency=payload.frequency,
        min_severity=payload.min_severity,
        enabled=payload.enabled,
        config=payload.config,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "channel": rule.channel}


@router.get("/rules")
async def list_rules(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.user_id == current_user.id)
    )
    return [
        {
            "id": str(r.id),
            "channel": r.channel,
            "frequency": r.frequency,
            "min_severity": r.min_severity,
            "enabled": r.enabled,
            "config": r.config or {},
        }
        for r in result.scalars().all()
    ]


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule id")
    result = await db.execute(
        select(NotificationRule).where(
            NotificationRule.id == rid, NotificationRule.user_id == current_user.id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    return {"success": True}


@router.post("/test")
async def test_send(
    payload: TestSendRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """Send a test message through the chosen channel."""
    ok = await send_notification(
        payload.channel, payload.destination, payload.subject, payload.body
    )
    return {"success": ok, "channel": payload.channel}
