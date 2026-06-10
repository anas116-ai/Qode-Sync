"""Teams & Organizations endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.models.team import Team, TeamMember, Organization, TeamRole
from app.models.user import UserProfile
from app.deps import get_current_user

router = APIRouter()


@router.post("/organizations")
async def create_organization(
    payload: dict,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = Organization(
        name=payload.get("name"),
        slug=payload.get("slug"),
        description=payload.get("description"),
        created_by=current_user.id,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return {"id": str(org.id), "name": org.name, "slug": org.slug}


@router.get("/organizations")
async def list_organizations(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization))
    return [{"id": str(o.id), "name": o.name, "slug": o.slug} for o in result.scalars().all()]


@router.post("/teams")
async def create_team(
    payload: dict,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    team = Team(
        name=payload.get("name"),
        slug=payload.get("slug"),
        description=payload.get("description"),
        created_by=current_user.id,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return {"id": str(team.id), "name": team.name, "slug": team.slug}


@router.get("/teams")
async def list_teams(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team))
    return [
        {"id": str(t.id), "name": t.name, "slug": t.slug, "description": t.description}
        for t in result.scalars().all()
    ]


@router.post("/teams/{team_id}/members")
async def add_member(
    team_id: str,
    payload: dict,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        tid = UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team id")
    role = payload.get("role", "member")
    try:
        role_enum = TeamRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

    member = TeamMember(
        team_id=tid,
        user_id=UUID(payload.get("user_id")),
        role=role_enum,
        invited_by=current_user.id,
    )
    db.add(member)
    await db.commit()
    return {"success": True}


@router.delete("/teams/{team_id}/members/{user_id}")
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == UUID(team_id),
            TeamMember.user_id == UUID(user_id),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
    return {"success": True}
