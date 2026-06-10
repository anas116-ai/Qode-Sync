from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.update import Update, UpdateStatus, UpdateType, UpdateSeverity
from app.models.repository import Repository
from app.models.user import UserProfile
from app.models.notification import NotificationRule
from app.schemas.update import UpdateResponse
from app.schemas.common import PaginatedResponse
from app.core.github import GitHubClient
from uuid import UUID
from datetime import datetime

router = APIRouter()


async def get_user(user_id: str, db: AsyncSession) -> UserProfile:
    uid = UUID(user_id)
    result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.get("/", response_model=PaginatedResponse)
async def list_updates(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query("", max_length=50),
    severity: str = Query("", max_length=50),
):
    await get_user(user_id, db)
    offset = (page - 1) * page_size
    query = select(Update).where(Update.user_id == UUID(user_id))
    if status and status != "all":
        query = query.where(Update.status == UpdateStatus(status))
    if severity and severity != "all":
        query = query.where(Update.severity == UpdateSeverity(severity))
    query = query.order_by(desc(Update.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    updates = result.scalars().all()
    count_query = select(func.count(Update.id)).where(Update.user_id == UUID(user_id))
    if status and status != "all":
        count_query = count_query.where(Update.status == UpdateStatus(status))
    if severity and severity != "all":
        count_query = count_query.where(Update.severity == UpdateSeverity(severity))
    total = (await db.execute(count_query)).scalar()
    return PaginatedResponse(
        data=list(updates),
        total=total if total else 0,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size) if total else 1,
    )


@router.post("/{update_id}/acknowledge")
async def acknowledge_update(update_id: str, user_id: str, db: AsyncSession = Depends(get_db)):
    await get_user(user_id, db)
    result = await db.execute(
        select(Update).where(Update.id == UUID(update_id), Update.user_id == UUID(user_id))
    )
    update = result.scalar_one_or_none()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    update.status = UpdateStatus.viewed
    await db.commit()
    return {"success": True}


@router.post("/detect")
async def detect_updates(user_id: str, db: AsyncSession = Depends(get_db)):
    profile = await get_user(user_id, db)
    result = await db.execute(
        select(Repository).where(
            Repository.user_id == profile.id, Repository.is_fork == True
        )
    )
    forks = result.scalars().all()
    return {"count": len(forks), "message": "Update detection queued"}
