from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.user import UserProfile
from app.models.sync import SyncJob, SyncJobStatus
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


@router.get("/status")
async def get_sync_status(user_id: str, db: AsyncSession = Depends(get_db)):
    await get_user(user_id, db)
    uid = UUID(user_id)
    result = await db.execute(
        select(SyncJob)
        .where(SyncJob.user_id == uid)
        .order_by(desc(SyncJob.created_at))
        .limit(20)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "job_type": j.job_type,
            "status": j.status.value if hasattr(j.status, "value") else str(j.status),
            "total_repos": j.total_repos,
            "processed_repos": j.processed_repos,
            "successful_repos": j.successful_repos,
            "failed_repos": j.failed_repos,
            "error_message": j.error_message,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.post("/trigger")
async def trigger_sync(user_id: str, db: AsyncSession = Depends(get_db)):
    profile = await get_user(user_id, db)

    if not profile.github_pat_encrypted:
        raise HTTPException(status_code=400, detail="No GitHub token configured")

    job = SyncJob(
        user_id=profile.id,
        job_type="full",
        status=SyncJobStatus.pending,
        total_repos=0,
        processed_repos=0,
        successful_repos=0,
        failed_repos=0,
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"success": True, "job_id": str(job.id), "status": "pending"}
