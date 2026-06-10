"""Patch Generation Engine - Create, manage, and apply custom patches for upstream merges."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from datetime import datetime
from typing import Optional
import hashlib

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.patch import Patch, PatchStatus, PatchFile, PatchApplication
from app.core.github import GitHubClient

router = APIRouter()


@router.post("/patches")
async def create_patch(
    repo_id: str,
    name: str,
    description: Optional[str] = None,
    target_branch: str = Query("main"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new patch for a repository."""
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository id")

    repo_result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    repo = repo_result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not current_user.github_pat_encrypted:
        raise HTTPException(status_code=400, detail="No GitHub token configured")

    client = GitHubClient(current_user.github_pat_encrypted)

    try:
        # Get current upstream state to generate the diff
        upstream_owner = repo.parent_owner
        upstream_name = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name
        upstream_branch = repo.parent_default_branch or "main"

        comparison = await client.compare_commits(
            repo.owner, repo.name,
            base=f"{upstream_owner}:{upstream_branch}",
            head=f"{repo.owner}:{target_branch}",
        )

        behind = int(comparison.get("behind_by", 0) or 0)
        commits = comparison.get("commits", []) or []
        files_modified = comparison.get("files", []) or []

        # Generate patch content
        patch_lines = []
        for file_data in files_modified[:50]:
            filename = file_data.get("filename", "")
            status = file_data.get("status", "modified")
            patch_lines.append(f"diff --git a/{filename} b/{filename}")
            patch_lines.append(f"--- a/{filename}")
            patch_lines.append(f"+++ b/{filename}")
            patch_lines.append(f"@@ -0,0 +1 @@")
            patch_lines.append(f"+# {status}: {filename} (changes from upstream)")
            patch_lines.append("")

        patch_content = "\n".join(patch_lines)
        content_hash = hashlib.sha256(patch_content.encode()).hexdigest()

        # Check for duplicate
        existing = await db.execute(
            select(Patch).where(Patch.hash == content_hash, Patch.repository_id == rid)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Patch with identical content already exists")

        patch = Patch(
            user_id=current_user.id,
            repository_id=rid,
            name=name,
            description=description,
            target_branch=target_branch,
            content=patch_content,
            hash=content_hash,
            upstream_sha=commits[0].get("sha", "") if commits else None,
            status=PatchStatus.active,
            tags=[],
        )
        db.add(patch)
        await db.flush()

        # Create patch file entries
        for file_data in files_modified[:50]:
            patch_file = PatchFile(
                patch_id=patch.id,
                file_path=file_data.get("filename", ""),
                change_type=file_data.get("status", "modified"),
                diff_content=str(file_data),
                line_count=file_data.get("additions", 0) + file_data.get("deletions", 0),
            )
            db.add(patch_file)

        await db.commit()
        await db.refresh(patch)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate patch: {exc}")

    return {
        "id": str(patch.id),
        "name": patch.name,
        "description": patch.description,
        "status": patch.status.value,
        "target_branch": patch.target_branch,
        "upstream_sha": patch.upstream_sha,
        "applies_cleanly": patch.applies_cleanly,
        "created_at": patch.created_at.isoformat() if patch.created_at else None,
    }


@router.get("/patches")
async def list_patches(
    repo_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List patches for the current user."""
    query = select(Patch).where(Patch.user_id == current_user.id)
    if repo_id:
        try:
            query = query.where(Patch.repository_id == UUID(repo_id))
        except ValueError:
            pass
    if status:
        try:
            query = query.where(Patch.status == PatchStatus(status))
        except ValueError:
            pass
    query = query.order_by(desc(Patch.created_at)).limit(limit)

    result = await db.execute(query)
    patches = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "repository_id": str(p.repository_id),
            "name": p.name,
            "description": p.description,
            "target_branch": p.target_branch,
            "status": p.status.value,
            "applies_cleanly": p.applies_cleanly,
            "priority": p.priority,
            "tags": p.tags or [],
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in patches
    ]


@router.get("/patches/{patch_id}")
async def get_patch(
    patch_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get patch details with files."""
    try:
        pid = UUID(patch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patch id")

    result = await db.execute(
        select(Patch).where(Patch.id == pid, Patch.user_id == current_user.id)
    )
    patch = result.scalar_one_or_none()
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")

    files_result = await db.execute(
        select(PatchFile).where(PatchFile.patch_id == pid)
    )
    files = files_result.scalars().all()

    applications_result = await db.execute(
        select(PatchApplication).where(PatchApplication.patch_id == pid).order_by(desc(PatchApplication.created_at))
    )
    applications = applications_result.scalars().all()

    return {
        "id": str(patch.id),
        "repository_id": str(patch.repository_id),
        "name": patch.name,
        "description": patch.description,
        "target_branch": patch.target_branch,
        "status": patch.status.value,
        "content": patch.content,
        "upstream_sha": patch.upstream_sha,
        "applies_cleanly": patch.applies_cleanly,
        "conflict_details": patch.conflict_details,
        "priority": patch.priority,
        "tags": patch.tags or [],
        "files": [
            {
                "file_path": f.file_path,
                "change_type": f.change_type,
                "line_count": f.line_count,
            }
            for f in files
        ],
        "applications": [
            {
                "id": str(a.id),
                "status": a.status,
                "applied_sha": a.applied_sha,
                "conflict_file_count": a.conflict_file_count,
                "error_message": a.error_message,
                "applied_at": a.applied_at.isoformat() if a.applied_at else None,
            }
            for a in applications
        ],
        "created_at": patch.created_at.isoformat() if patch.created_at else None,
        "updated_at": patch.updated_at.isoformat() if patch.updated_at else None,
    }


@router.put("/patches/{patch_id}")
async def update_patch(
    patch_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    priority: Optional[int] = None,
    tags: Optional[str] = None,
    status: Optional[str] = None,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update patch metadata."""
    try:
        pid = UUID(patch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patch id")

    result = await db.execute(
        select(Patch).where(Patch.id == pid, Patch.user_id == current_user.id)
    )
    patch = result.scalar_one_or_none()
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")

    if name is not None:
        patch.name = name
    if description is not None:
        patch.description = description
    if priority is not None:
        patch.priority = priority
    if tags is not None:
        patch.tags = tags.split(",") if tags else []
    if status is not None:
        try:
            patch.status = PatchStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    await db.commit()
    return {"success": True, "id": str(patch.id)}


@router.delete("/patches/{patch_id}")
async def delete_patch(
    patch_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a patch."""
    try:
        pid = UUID(patch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patch id")

    result = await db.execute(
        select(Patch).where(Patch.id == pid, Patch.user_id == current_user.id)
    )
    patch = result.scalar_one_or_none()
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")

    await db.delete(patch)
    await db.commit()
    return {"success": True}
