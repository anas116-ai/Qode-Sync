"""Bookmark & Watchlist endpoints — flips booleans on Repository rows."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository

router = APIRouter()


async def _get_repo(repo_id: str, current_user: UserProfile, db: AsyncSession) -> Repository:
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repo id")
    result = await db.execute(
        select(Repository).where(
            Repository.id == rid, Repository.user_id == current_user.id
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.post("/{repo_id}/bookmark")
async def toggle_bookmark(
    repo_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _get_repo(repo_id, current_user, db)
    repo.is_bookmarked = not repo.is_bookmarked
    await db.commit()
    return {"bookmarked": repo.is_bookmarked}


@router.post("/{repo_id}/watch")
async def toggle_watch(
    repo_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _get_repo(repo_id, current_user, db)
    repo.is_watched = not repo.is_watched
    await db.commit()
    return {"watched": repo.is_watched}


@router.post("/bulk")
async def bulk_action(
    payload: dict,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk actions: bookmark_all, unwatch_all, sync_status_filter."""
    action = payload.get("action")
    repo_ids = payload.get("repo_ids", [])
    if not isinstance(repo_ids, list) or not repo_ids:
        raise HTTPException(status_code=400, detail="repo_ids must be a non-empty list")

    try:
        uuids = [UUID(r) for r in repo_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repo id in list")

    result = await db.execute(
        select(Repository).where(
            Repository.id.in_(uuids), Repository.user_id == current_user.id
        )
    )
    repos = result.scalars().all()
    for repo in repos:
        if action == "bookmark":
            repo.is_bookmarked = True
        elif action == "unbookmark":
            repo.is_bookmarked = False
        elif action == "watch":
            repo.is_watched = True
        elif action == "unwatch":
            repo.is_watched = False
        elif action == "delete":
            await db.delete(repo)
    await db.commit()
    return {"affected": len(repos), "action": action}
