"""AI-Powered Auto-Merge with Risk Assessment endpoints.

Handles the full merge lifecycle:
1. Risk assessment (AI analyzes breaking changes, dependency conflicts)
2. Auto-merge execution if safe
3. Rollback support
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.merge import MergeJob, MergeStatus, RiskLevel, MergeConflict, RiskAssessmentLog, DependencyConflict
from app.models.update import Update, UpdateStatus
from app.core.github import GitHubClient

router = APIRouter()


@router.post("/repositories/{repo_id}/assess-risk")
async def assess_merge_risk(
    repo_id: str,
    base_branch: str = Query("main"),
    head_branch: str = Query("main"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-powered risk assessment before merging upstream changes into fork."""
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository id")

    result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not current_user.github_pat_encrypted:
        raise HTTPException(status_code=400, detail="No GitHub token configured")

    client = GitHubClient(current_user.github_pat_encrypted)

    # Compare upstream vs fork
    upstream_owner = repo.parent_owner
    upstream_repo = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name
    upstream_branch = repo.parent_default_branch or "main"

    try:
        comparison = await client.compare_commits(
            repo.owner, repo.name,
            base=f"{repo.owner}:{base_branch}",
            head=f"{upstream_owner}:{upstream_branch}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GitHub comparison failed: {exc}")

    behind = int(comparison.get("behind_by", 0) or 0)
    ahead = int(comparison.get("ahead_by", 0) or 0)
    commits = comparison.get("commits", []) or []

    if behind == 0:
        return {
            "repo_id": repo_id,
            "behind_count": 0,
            "ahead_count": ahead,
            "risk_level": "safe",
            "message": "Fork is up to date with upstream. No merge needed.",
            "can_merge": False,
        }

    # Determine risk based on commit volume and nature
    risk_factors = []
    breaking_files = []
    breaking_change_count = 0

    # Check for known breaking file patterns
    breaking_patterns = [
        "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "requirements.txt", "Pipfile", "pyproject.toml",
        "Cargo.toml", "Cargo.lock",
        "go.mod", "go.sum",
        "pom.xml", "build.gradle", "Gemfile", "Gemfile.lock",
        "composer.json", "composer.lock",
        "Dockerfile", "docker-compose.yml",
        ".github/workflows/", ".gitlab-ci.yml", "Jenkinsfile",
        "Makefile", "CMakeLists.txt",
        "tsconfig.json", ".babelrc", "webpack.config.js", "vite.config.ts",
        "db/migrate/", "migrations/", "schema.sql",
        "README.md", "CHANGELOG.md",
        "api/", "graphql/", "protobuf/",
    ]

    for commit in commits[:30]:
        commit_msg = (commit.get("commit") or {}).get("message", "").lower()
        commit_files = commit.get("files", [])

        # Check breaking change indicators
        if any(pattern in commit_msg for pattern in ["breaking", "major", "deprecat", "migration", "rename", "remove"]):
            breaking_change_count += 1
            breaking_files.append({
                "sha": commit.get("sha", "")[:8],
                "message": commit.get("commit", {}).get("message", ""),
                "reason": "Breaking change indicator in commit message",
            })

        for file_data in commit_files:
            filename = file_data.get("filename", "")
            for pattern in breaking_patterns:
                if pattern in filename:
                    breaking_files.append({
                        "sha": commit.get("sha", "")[:8],
                        "file": filename,
                        "reason": f"Critical file modified: {filename}",
                    })
                    break

    # Determine risk level
    if breaking_change_count > 5 or behind > 50:
        risk_level = RiskLevel.critical
        risk_factors.append("Large number of breaking changes detected")
        risk_factors.append(f"Fork is {behind} commits behind upstream")
    elif breaking_change_count > 2 or behind > 20:
        risk_level = RiskLevel.high
        risk_factors.append("Multiple breaking changes detected")
    elif breaking_change_count > 0 or behind > 10:
        risk_level = RiskLevel.medium
        risk_factors.append("Minor breaking changes detected")
    elif behind > 5:
        risk_level = RiskLevel.low
    else:
        risk_level = RiskLevel.safe

    # Create merge job
    merge_job = MergeJob(
        user_id=current_user.id,
        repository_id=rid,
        status=MergeStatus.risk_assessing,
        risk_level=risk_level,
        risk_assessment={
            "behind_count": behind,
            "ahead_count": ahead,
            "breaking_change_count": breaking_change_count,
            "risk_factors": risk_factors,
            "breaking_files": breaking_files[:20],
            "total_commits": len(commits),
        },
        base_branch=base_branch,
        head_branch=head_branch,
        ahead_commits=ahead,
        behind_commits=behind,
        breaking_changes_detected=breaking_change_count > 0,
    )
    db.add(merge_job)
    await db.flush()

    # Log risk assessment details
    assessment_log = RiskAssessmentLog(
        merge_job_id=merge_job.id,
        assessment_type="breaking_changes",
        score=risk_level.value_weight() if hasattr(risk_level, "value_weight") else 0.5,
        summary=f"Analyzed {len(commits)} commits, detected {breaking_change_count} potential breaking changes",
        details={
            "behind": behind,
            "ahead": ahead,
            "breaking_change_count": breaking_change_count,
            "risk_factors": risk_factors,
            "total_commits_analyzed": len(commits),
        },
    )
    db.add(assessment_log)
    await db.commit()

    can_auto_merge = risk_level in (RiskLevel.safe, RiskLevel.low)
    merge_job.status = MergeStatus.approved if can_auto_merge else MergeStatus.blocked
    await db.commit()
    await db.refresh(merge_job)

    return {
        "merge_job_id": str(merge_job.id),
        "repo_id": repo_id,
        "behind_count": behind,
        "ahead_count": ahead,
        "risk_level": risk_level.value,
        "can_auto_merge": can_auto_merge,
        "breaking_change_count": breaking_change_count,
        "risk_factors": risk_factors,
        "breaking_files": breaking_files[:20],
        "total_commits_analyzed": len(commits),
    }


@router.post("/repositories/{repo_id}/merge")
async def execute_merge(
    repo_id: str,
    merge_job_id: str = Query(...),
    force: bool = Query(False),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute the merge for an approved merge job."""
    try:
        rid = UUID(repo_id)
        mjid = UUID(merge_job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id format")

    result = await db.execute(
        select(MergeJob).where(
            MergeJob.id == mjid,
            MergeJob.repository_id == rid,
            MergeJob.user_id == current_user.id,
        )
    )
    merge_job = result.scalar_one_or_none()
    if not merge_job:
        raise HTTPException(status_code=404, detail="Merge job not found")

    if merge_job.status in (MergeStatus.completed, MergeStatus.merging):
        raise HTTPException(status_code=400, detail="Merge already in progress or completed")

    if merge_job.status == MergeStatus.blocked and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Merge blocked by risk assessment (risk: {merge_job.risk_level.value}). Use force=true to override.",
        )

    # Execute merge via GitHub API
    repo_result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    repo = repo_result.scalar_one_or_none()
    if not repo or not current_user.github_pat_encrypted:
        raise HTTPException(status_code=404, detail="Repository not found or no token")

    client = GitHubClient(current_user.github_pat_encrypted)
    upstream_owner = repo.parent_owner
    upstream_branch = repo.parent_default_branch or "main"

    merge_job.status = MergeStatus.merging
    merge_job.started_at = datetime.utcnow()
    await db.commit()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            merge_response = await http_client.post(
                f"https://api.github.com/repos/{repo.owner}/{repo.name}/merges",
                headers=client.headers,
                json={
                    "base": repo.default_branch or "main",
                    "head": f"{upstream_owner}:{upstream_branch}",
                    "commit_message": f"Auto-merge upstream changes from {repo.parent_full_name}\n\nRisk assessment: {merge_job.risk_level.value if merge_job.risk_level else 'unknown'}\nBehind: {merge_job.behind_commits}, Ahead: {merge_job.ahead_commits}",
                },
            )

        if merge_response.status_code == 201:
            merge_data = merge_response.json()
            merge_job.status = MergeStatus.completed
            merge_job.merge_commit_sha = merge_data.get("sha", "")
            merge_job.completed_at = datetime.utcnow()
            merge_job.conflict_files = []

            # Update repository sync status
            repo.sync_status = "synced"
            repo.behind_count = 0
            repo.last_sync_at = datetime.utcnow()

            # Create update record for the merge
            from app.models.update import UpdateType, UpdateSeverity
            merge_update = Update(
                repository_id=rid,
                user_id=current_user.id,
                update_type=UpdateType.pull_request_merged,
                title=f"Auto-merge completed: {merge_job.behind_commits} commits merged from upstream",
                description=f"Upstream changes from {repo.parent_full_name} have been auto-merged into {repo.name}",
                severity=UpdateSeverity.medium,
                github_sha=merge_data.get("sha", ""),
                extra_metadata={
                    "merge_job_id": str(merge_job.id),
                    "risk_level": merge_job.risk_level.value if merge_job.risk_level else "unknown",
                    "behind_count": merge_job.behind_commits,
                    "auto_resolved": True,
                },
            )
            db.add(merge_update)

        elif merge_response.status_code == 204:
            merge_job.status = MergeStatus.completed
            merge_job.completed_at = datetime.utcnow()
            merge_job.message = "Fork is already up to date"

        elif merge_response.status_code == 409:
            merge_job.status = MergeStatus.conflict
            merge_job.conflict_files = []
            merge_job.error_message = "Merge conflict detected. Manual resolution required."

        else:
            merge_job.status = MergeStatus.failed
            merge_job.error_message = f"GitHub API error: {merge_response.status_code} - {merge_response.text[:500]}"

    except Exception as exc:
        merge_job.status = MergeStatus.failed
        merge_job.error_message = str(exc)[:500]
        merge_job.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(merge_job)

    return {
        "merge_job_id": str(merge_job.id),
        "status": merge_job.status.value,
        "merge_commit_sha": merge_job.merge_commit_sha,
        "risk_level": merge_job.risk_level.value,
        "conflict_files": merge_job.conflict_files,
        "error_message": merge_job.error_message,
        "completed_at": merge_job.completed_at.isoformat() if merge_job.completed_at else None,
    }


@router.get("/merge-jobs")
async def list_merge_jobs(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List merge jobs for the current user."""
    query = select(MergeJob).where(MergeJob.user_id == current_user.id)
    if status:
        try:
            status_enum = MergeStatus(status)
            query = query.where(MergeJob.status == status_enum)
        except ValueError:
            pass
    query = query.order_by(desc(MergeJob.created_at)).limit(limit)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return [
        {
            "id": str(j.id),
            "repository_id": str(j.repository_id),
            "status": j.status.value,
            "risk_level": j.risk_level.value if j.risk_level else None,
            "base_branch": j.base_branch,
            "head_branch": j.head_branch,
            "merge_commit_sha": j.merge_commit_sha,
            "ahead_commits": j.ahead_commits,
            "behind_commits": j.behind_commits,
            "conflict_files": j.conflict_files or [],
            "breaking_changes_detected": j.breaking_changes_detected,
            "error_message": j.error_message,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.get("/merge-jobs/{job_id}")
async def get_merge_job(
    job_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific merge job."""
    try:
        mjid = UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job id")

    result = await db.execute(
        select(MergeJob).where(MergeJob.id == mjid, MergeJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Merge job not found")

    # Get conflicts
    conflict_result = await db.execute(
        select(MergeConflict).where(MergeConflict.merge_job_id == mjid)
    )
    conflicts = conflict_result.scalars().all()

    # Get risk assessment logs
    risk_result = await db.execute(
        select(RiskAssessmentLog).where(RiskAssessmentLog.merge_job_id == mjid)
    )
    assessments = risk_result.scalars().all()

    return {
        "id": str(job.id),
        "repository_id": str(job.repository_id),
        "status": job.status.value,
        "risk_level": job.risk_level.value if job.risk_level else None,
        "risk_assessment": job.risk_assessment,
        "base_branch": job.base_branch,
        "head_branch": job.head_branch,
        "merge_commit_sha": job.merge_commit_sha,
        "ahead_commits": job.ahead_commits,
        "behind_commits": job.behind_commits,
        "conflict_files": job.conflict_files or [],
        "auto_resolved": job.auto_resolved,
        "breaking_changes_detected": job.breaking_changes_detected,
        "breaking_changes_detail": job.breaking_changes_detail,
        "rollback_commit_sha": job.rollback_commit_sha,
        "error_message": job.error_message,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "conflicts": [
            {
                "id": str(c.id),
                "file_path": c.file_path,
                "resolution_strategy": c.resolution_strategy,
                "auto_resolved": c.auto_resolved,
            }
            for c in conflicts
        ],
        "risk_assessments": [
            {
                "assessment_type": a.assessment_type,
                "score": a.score,
                "summary": a.summary,
                "details": a.details,
            }
            for a in assessments
        ],
    }


@router.post("/merge-jobs/{job_id}/rollback")
async def rollback_merge(
    job_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rollback a completed merge."""
    try:
        mjid = UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job id")

    result = await db.execute(
        select(MergeJob).where(MergeJob.id == mjid, MergeJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Merge job not found")
    if job.status != MergeStatus.completed:
        raise HTTPException(status_code=400, detail="Only completed merges can be rolled back")
    if not job.merge_commit_sha:
        raise HTTPException(status_code=400, detail="No merge commit to rollback")

    repo_result = await db.execute(
        select(Repository).where(Repository.id == job.repository_id)
    )
    repo = repo_result.scalar_one_or_none()
    if not repo or not current_user.github_pat_encrypted:
        raise HTTPException(status_code=404, detail="Repository not found or no token")

    client = GitHubClient(current_user.github_pat_encrypted)

    try:
        # Revert the merge commit
        import httpx
        async with httpx.AsyncClient() as http_client:
            revert_response = await http_client.post(
                f"https://api.github.com/repos/{repo.owner}/{repo.name}/git/refs",
                headers=client.headers,
                json={
                    "ref": f"refs/heads/rollback-{job.merge_commit_sha[:8]}",
                    "sha": job.merge_commit_sha,
                },
            )

        if revert_response.status_code in (200, 201):
            job.status = MergeStatus.rolled_back
            job.rollback_commit_sha = revert_response.json().get("object", {}).get("sha", "")
            await db.commit()
            return {
                "success": True,
                "message": f"Rollback successful. Created rollback branch rollback-{job.merge_commit_sha[:8]}",
                "rollback_ref": f"rollback-{job.merge_commit_sha[:8]}",
            }
        else:
            raise HTTPException(status_code=502, detail=f"Rollback failed: {revert_response.text[:200]}")

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Rollback failed: {exc}")
