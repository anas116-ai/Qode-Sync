"""AI Assistant endpoints — uses the AI provider abstraction."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user
from app.models.user import UserProfile
from app.core.ai import ai_provider
from app.database import get_db

router = APIRouter()


class CommitSummaryRequest(BaseModel):
    commits: list[dict]


class ReleaseSummaryRequest(BaseModel):
    name: str
    body: str


class BreakingChangesRequest(BaseModel):
    diff: str


class InsightRequest(BaseModel):
    title: str
    description: str
    type: str


@router.post("/summarize-commits")
async def summarize_commits(
    req: CommitSummaryRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.commits:
        raise HTTPException(status_code=400, detail="commits list cannot be empty")
    return await ai_provider.summarize_commits(req.commits)


@router.post("/summarize-release")
async def summarize_release(
    req: ReleaseSummaryRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_provider.summarize_release(req.name, req.body)


@router.post("/explain-breaking-changes")
async def explain_breaking_changes(
    req: BreakingChangesRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_provider.explain_breaking_changes(req.diff)


@router.post("/update-insight")
async def update_insight(
    req: InsightRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_provider.generate_update_insight(req.title, req.description, req.type)
