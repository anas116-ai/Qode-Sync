from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.update import Update
from uuid import UUID

router = APIRouter()


async def get_user(user_id: str, db: AsyncSession) -> UserProfile:
    uid = UUID(user_id)
    result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.get("/stats")
async def get_stats(user_id: str, db: AsyncSession = Depends(get_db)):
    profile = await get_user(user_id, db)
    uid = UUID(user_id)

    total_forks = await db.execute(
        select(func.count(Repository.id)).where(
            Repository.user_id == uid, Repository.is_fork == True
        )
    )
    total_forks_val = total_forks.scalar() or 0

    updated_forks = await db.execute(
        select(func.count(Repository.id)).where(
            Repository.user_id == uid,
            Repository.is_fork == True,
            Repository.sync_status != "synced",
        )
    )
    updated_forks_val = updated_forks.scalar() or 0

    critical_updates = await db.execute(
        select(func.count(Update.id)).where(
            Update.user_id == uid,
            Update.severity == "critical",
            Update.status == "new",
        )
    )
    critical_updates_val = critical_updates.scalar() or 0

    return {
        "total_forks": total_forks_val,
        "updated_forks": updated_forks_val,
        "critical_updates": critical_updates_val,
        "last_sync": profile.last_sync_at.isoformat() if profile.last_sync_at else None,
    }


@router.get("/top-repositories")
async def get_top_repositories(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(5, ge=1, le=20),
):
    await get_user(user_id, db)
    uid = UUID(user_id)
    result = await db.execute(
        select(Repository)
        .where(Repository.user_id == uid)
        .order_by(desc(Repository.stars_count))
        .limit(limit)
    )
    repos = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "full_name": r.full_name,
            "stars": r.stars_count,
            "behind": r.behind_count,
            "sync_status": r.sync_status,
        }
        for r in repos
    ]
