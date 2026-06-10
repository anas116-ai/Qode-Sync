from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.database import get_db
from app.models.user import UserProfile, TokenStatus
from app.schemas.user import UserProfileCreate, UserProfileUpdate, UserProfileResponse
from app.core.security import create_access_token, verify_token
from app.core.crypto import encrypt_token
from datetime import datetime, timedelta
import httpx

router = APIRouter()


@router.post("/login-pat")
async def login_with_pat(payload: dict, db: AsyncSession = Depends(get_db)):
    pat = payload.get("pat") if isinstance(payload, dict) else None
    if not pat:
        raise HTTPException(status_code=400, detail="pat is required")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github+json"},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        gh_user = response.json()

    result = await db.execute(
        select(UserProfile).where(UserProfile.github_id == gh_user["id"])
    )
    profile = result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(
            username=gh_user["login"],
            display_name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            email=gh_user.get("email"),
            github_id=gh_user["id"],
            github_pat_encrypted=encrypt_token(pat),
            token_status=TokenStatus.valid,
            token_last_validated=datetime.utcnow(),
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    else:
        profile.github_pat_encrypted = encrypt_token(pat)
        profile.token_status = TokenStatus.valid
        profile.token_last_validated = datetime.utcnow()
        await db.commit()
        await db.refresh(profile)

    access_token = create_access_token(
        data={"sub": str(profile.id), "username": profile.username},
        expires_delta=timedelta(days=7),
    )
    refresh_token = create_access_token(
        data={"sub": str(profile.id), "type": "refresh"},
        expires_delta=timedelta(days=30),
    )
    return {
        "user": profile.to_dict() if hasattr(profile, "to_dict") else {
            "id": str(profile.id),
            "username": profile.username,
            "email": profile.email,
            "avatar_url": profile.avatar_url,
            "github_id": profile.github_id,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
async def refresh_token(payload: dict, db: AsyncSession = Depends(get_db)):
    token = payload.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token required")
    data = verify_token(token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access_token = create_access_token(
        data={"sub": data["sub"]},
        expires_delta=timedelta(days=7),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    update: UserProfileUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile
