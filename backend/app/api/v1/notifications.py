from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
from app.database import get_db
from app.models.notification import Notification, NotificationRule, NotificationChannel
from app.models.user import UserProfile
from app.schemas.notification import NotificationResponse, NotificationRuleCreate
from app.schemas.common import PaginatedResponse
from uuid import UUID

router = APIRouter()


async def get_user(user_id: str, db: AsyncSession) -> UserProfile:
    uid = UUID(user_id)
    result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.get("/", response_model=PaginatedResponse)
async def list_notifications(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    channel: str = Query(None),
):
    await get_user(user_id, db)
    offset = (page - 1) * page_size
    query = select(Notification).where(Notification.user_id == UUID(user_id))
    if status:
        if status == "unread":
            query = query.where(Notification.is_read == False)
        elif status == "read":
            query = query.where(Notification.is_read == True)
    if channel:
        query = query.where(Notification.channel == channel)
    query = query.order_by(desc(Notification.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    notifications = result.scalars().all()
    count_query = select(func.count(Notification.id)).where(Notification.user_id == UUID(user_id))
    if status:
        if status == "unread":
            count_query = count_query.where(Notification.is_read == False)
        elif status == "read":
            count_query = count_query.where(Notification.is_read == True)
    if channel:
        count_query = count_query.where(Notification.channel == channel)
    total = (await db.execute(count_query)).scalar()
    return PaginatedResponse(
        data=list(notifications),
        total=total if total else 0,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size) if total else 1,
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    await get_user(user_id, db)
    result = await db.execute(
        select(Notification).where(
            Notification.id == UUID(notification_id),
            Notification.user_id == UUID(user_id),
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    notification.status = "read"
    await db.commit()
    return {"success": True}


@router.post("/read-all")
async def mark_all_notifications_read(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    await get_user(user_id, db)
    stmt = (
        update(Notification)
        .where(Notification.user_id == UUID(user_id), Notification.is_read == False)
        .values(is_read=True, status="read")
    )
    await db.execute(stmt)
    await db.commit()
    return {"success": True}


@router.post("/rules")
async def create_notification_rule(
    rule: NotificationRuleCreate,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    await get_user(user_id, db)
    new_rule = NotificationRule(
        user_id=UUID(user_id),
        channel=rule.channel,
        frequency=rule.frequency,
        min_severity=rule.min_severity,
        enabled=rule.enabled,
        config=rule.config,
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return {"success": True}


@router.post("/test")
async def test_notification(user_id: str, channel: str, db: AsyncSession = Depends(get_db)):
    await get_user(user_id, db)
    return {"success": True, "message": f"Test notification sent to {channel}"}
