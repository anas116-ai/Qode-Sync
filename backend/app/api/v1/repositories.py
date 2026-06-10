from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.repository import Repository
from app.models.user import UserProfile
from app.schemas.repository import RepositoryResponse, RepositoryUpdate
from app.schemas.common import PaginatedResponse
from app.core.github import GitHubClient
from app.core.crypto import decrypt_token
from datetime import datetime
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
async def list_repositories(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=200),
    status: str = Query("", max_length=50),
    sort_by: str = Query("updated_at", max_length=50),
):
    profile = await get_user(user_id, db)
    offset = (page - 1) * page_size

    query = select(Repository).where(Repository.user_id == profile.id)
    if search:
        query = query.where(Repository.full_name.ilike(f"%{search}%"))
    if status and status != "all":
        query = query.where(Repository.sync_status == status)

    sort_col = getattr(Repository, sort_by, Repository.updated_at)
    query = query.order_by(desc(sort_col)).offset(offset).limit(page_size)
    result = await db.execute(query)
    repos = result.scalars().all()

    count_query = select(func.count(Repository.id)).where(Repository.user_id == profile.id)
    if search:
        count_query = count_query.where(Repository.full_name.ilike(f"%{search}%"))
    if status and status != "all":
        count_query = count_query.where(Repository.sync_status == status)
    total = (await db.execute(count_query)).scalar()

    return PaginatedResponse(
        data=list(repos),
        total=total if total else 0,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size) if total else 1,
    )


@router.post("/sync")
async def sync_repositories(user_id: str, db: AsyncSession = Depends(get_db)):
    profile = await get_user(user_id, db)
    if not profile.github_pat_encrypted:
        raise HTTPException(status_code=400, detail="No GitHub token configured")
    token = decrypt_token(profile.github_pat_encrypted)
    if not token:
        raise HTTPException(status_code=400, detail="Failed to decrypt GitHub token")
    client = GitHubClient(token)
    forks = await client.get_forks()
    synced = 0
    for fork_data in forks:
        parent = fork_data.get("parent", {})
        result = await db.execute(
            select(Repository).where(
                Repository.user_id == profile.id,
                Repository.github_id == fork_data["id"],
            )
        )
        repo = result.scalar_one_or_none()
        if not repo:
            repo = Repository(
                user_id=profile.id,
                github_id=fork_data["id"],
                name=fork_data["name"],
                full_name=fork_data["full_name"],
                owner=fork_data["owner"]["login"],
                description=fork_data.get("description"),
                language=fork_data.get("language"),
                is_fork=True,
                archived=fork_data.get("archived", False),
                stars_count=fork_data.get("stargazers_count", 0),
                forks_count=fork_data.get("forks_count", 0),
                open_issues_count=fork_data.get("open_issues_count", 0),
                parent_github_id=parent.get("id"),
                parent_full_name=parent.get("full_name"),
                parent_owner=parent.get("owner", {}).get("login"),
            )
            db.add(repo)
        else:
            repo.archived = fork_data.get("archived", False)
            repo.stars_count = fork_data.get("stargazers_count", 0)
            repo.forks_count = fork_data.get("forks_count", 0)
        synced += 1
    profile.last_sync_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "synced": synced}


@router.put("/{repo_id}/watch", response_model=RepositoryResponse)
async def update_watch_status(
    repo_id: str,
    update: RepositoryUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    profile = await get_user(user_id, db)
    result = await db.execute(
        select(Repository).where(
            Repository.id == UUID(repo_id),
            Repository.user_id == profile.id,
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    payload = update.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(repo, key, value)
    await db.commit()
    await db.refresh(repo)
    return repo


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(repo_id: str, user_id: str, db: AsyncSession = Depends(get_db)):
    profile = await get_user(user_id, db)
    result = await db.execute(
        select(Repository).where(
            Repository.id == UUID(repo_id),
            Repository.user_id == profile.id,
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo
