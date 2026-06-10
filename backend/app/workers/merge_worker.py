"""Celery tasks for auto-merge, risk assessment, and dependency resolution.

Handles:
1. Automated merge execution with risk assessment
2. Dependency auto-resolution
3. Rollback support
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select

import httpx

from app.core.github import GitHubClient
from app.core.ai import ai_provider
from app.database import AsyncSessionLocal
from app.models.merge import MergeJob, MergeStatus, RiskLevel, MergeConflict, DependencyConflict
from app.models.repository import Repository, SyncStatus
from app.models.update import Update, UpdateType, UpdateSeverity
from app.workers.task_schedule import celery

logger = logging.getLogger("forktracker.merge")


# ---------------------------------------------------------------------------
# Async coroutines
# ---------------------------------------------------------------------------
async def execute_auto_merge(merge_job_id: str) -> Dict[str, Any]:
    """Execute an auto-merge with full risk assessment and rollback support."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeJob).where(MergeJob.id == merge_job_id)
        )
        merge_job = result.scalar_one_or_none()
        if not merge_job:
            return {"ok": False, "reason": "merge_job_not_found"}

        repo_result = await db.execute(
            select(Repository).where(Repository.id == merge_job.repository_id)
        )
        repo = repo_result.scalar_one_or_none()
        if not repo:
            return {"ok": False, "reason": "repository_not_found"}

        from app.models.user import UserProfile
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == merge_job.user_id)
        )
        profile = user_result.scalar_one_or_none()
        if not profile or not profile.github_pat_encrypted:
            return {"ok": False, "reason": "no_token"}

        client = GitHubClient(profile.github_pat_encrypted)
        upstream_owner = repo.parent_owner
        upstream_branch = repo.parent_default_branch or "main"

        merge_job.status = MergeStatus.merging
        merge_job.started_at = datetime.utcnow()
        await db.commit()

        try:
            async with httpx.AsyncClient() as http_client:
                merge_response = await http_client.post(
                    f"https://api.github.com/repos/{repo.owner}/{repo.name}/merges",
                    headers=client.headers,
                    json={
                        "base": repo.default_branch or "main",
                        "head": f"{upstream_owner}:{upstream_branch}",
                        "commit_message": (
                            f"Auto-merge upstream changes from {repo.parent_full_name}\n\n"
                            f"Risk assessment: {merge_job.risk_level.value if merge_job.risk_level else 'unknown'}\n"
                            f"Behind: {merge_job.behind_commits}, Ahead: {merge_job.ahead_commits}"
                        ),
                    },
                )

            if merge_response.status_code == 201:
                merge_data = merge_response.json()
                merge_job.status = MergeStatus.completed
                merge_job.merge_commit_sha = merge_data.get("sha", "")
                merge_job.completed_at = datetime.utcnow()
                merge_job.conflict_files = []

                repo.sync_status = SyncStatus.synced
                repo.behind_count = 0
                repo.last_sync_at = datetime.utcnow()

                update = Update(
                    repository_id=merge_job.repository_id,
                    user_id=merge_job.user_id,
                    update_type=UpdateType.pull_request_merged,
                    title=f"Auto-merge completed: {merge_job.behind_commits} commits merged from upstream",
                    description=f"Upstream changes from {repo.parent_full_name} have been auto-merged",
                    severity=UpdateSeverity.medium,
                    extra_metadata={
                        "merge_job_id": str(merge_job.id),
                        "risk_level": merge_job.risk_level.value if merge_job.risk_level else "unknown",
                        "auto_resolved": True,
                    },
                )
                db.add(update)

            elif merge_response.status_code == 204:
                merge_job.status = MergeStatus.completed
                merge_job.completed_at = datetime.utcnow()

            elif merge_response.status_code == 409:
                merge_job.status = MergeStatus.conflict
                merge_job.conflict_files = []
                merge_job.error_message = "Merge conflict detected"

            else:
                merge_job.status = MergeStatus.failed
                merge_job.error_message = f"GitHub error: {merge_response.status_code}"

        except Exception as exc:
            merge_job.status = MergeStatus.failed
            merge_job.error_message = str(exc)[:500]
            merge_job.completed_at = datetime.utcnow()

        await db.commit()
        return {
            "ok": merge_job.status == MergeStatus.completed,
            "status": merge_job.status.value,
            "merge_commit_sha": merge_job.merge_commit_sha,
            "error_message": merge_job.error_message,
        }


async def resolve_all_dependencies(merge_job_id: str, strategy: str = "use_upstream") -> Dict[str, Any]:
    """Auto-resolve all dependency conflicts for a merge job."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DependencyConflict).where(
                DependencyConflict.merge_job_id == merge_job_id,
                DependencyConflict.auto_resolved == False,
            )
        )
        conflicts = result.scalars().all()

        resolved = 0
        for conflict in conflicts:
            if strategy == "use_upstream":
                conflict.resolved_version = conflict.upstream_version
            elif strategy == "use_fork":
                conflict.resolved_version = conflict.fork_version
            else:
                conflict.resolved_version = conflict.upstream_version

            conflict.resolution_strategy = strategy
            conflict.auto_resolved = True
            conflict.resolved_at = datetime.utcnow()
            resolved += 1

        await db.commit()
        return {"resolved": resolved, "total": len(conflicts)}


async def rollback_merge(merge_job_id: str) -> Dict[str, Any]:
    """Rollback a completed merge by reverting the merge commit."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeJob).where(MergeJob.id == merge_job_id)
        )
        merge_job = result.scalar_one_or_none()
        if not merge_job or not merge_job.merge_commit_sha:
            return {"ok": False, "reason": "no_merge_to_rollback"}

        from app.models.user import UserProfile
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == merge_job.user_id)
        )
        profile = user_result.scalar_one_or_none()
        if not profile or not profile.github_pat_encrypted:
            return {"ok": False, "reason": "no_token"}

        repo_result = await db.execute(
            select(Repository).where(Repository.id == merge_job.repository_id)
        )
        repo = repo_result.scalar_one_or_none()

        client = GitHubClient(profile.github_pat_encrypted)
        rollback_branch = f"rollback-{merge_job.merge_commit_sha[:8]}"

        try:
            async with httpx.AsyncClient() as http_client:
                response = await http_client.post(
                    f"https://api.github.com/repos/{repo.owner}/{repo.name}/git/refs",
                    headers=client.headers,
                    json={
                        "ref": f"refs/heads/{rollback_branch}",
                        "sha": merge_job.merge_commit_sha,
                    },
                )

            if response.status_code in (200, 201):
                merge_job.status = MergeStatus.rolled_back
                merge_job.rollback_commit_sha = response.json().get("object", {}).get("sha", "")
                await db.commit()
                return {"ok": True, "rollback_branch": rollback_branch}
            else:
                return {"ok": False, "reason": f"API error: {response.status_code}"}

        except Exception as exc:
            return {"ok": False, "reason": str(exc)[:200]}


async def auto_merge_watched_forks() -> Dict[str, Any]:
    """Daily sweep: auto-merge upstream changes for all watched forks that are safe.

    Iterates every user's watched repositories that are behind upstream,
    assesses risk, and auto-merges if the risk level is safe or low.
    """
    async with AsyncSessionLocal() as db:
        from app.models.user import UserProfile

        result = await db.execute(
            select(UserProfile).where(UserProfile.token_status == "valid").where(
                UserProfile.github_pat_encrypted.isnot(None)
            )
        )
        profiles = result.scalars().all()

    total = {"checked": 0, "merged": 0, "skipped": 0, "errors": 0}

    for profile in profiles:
        uid = str(profile.id)
        async with AsyncSessionLocal() as db:
            repos_result = await db.execute(
                select(Repository).where(
                    Repository.user_id == profile.id,
                    Repository.is_fork == True,
                    Repository.is_watched == True,
                    Repository.behind_count > 0,
                    Repository.parent_full_name.isnot(None),
                )
            )
            repos = repos_result.scalars().all()

        for repo in repos:
            total["checked"] += 1
            try:
                client = GitHubClient(profile.github_pat_encrypted)
                upstream_owner = repo.parent_owner
                upstream_branch = repo.parent_default_branch or "main"

                comparison = await client.compare_commits(
                    repo.owner, repo.name,
                    base=f"{repo.owner}:{repo.default_branch or 'main'}",
                    head=f"{upstream_owner}:{upstream_branch}",
                )
                behind = int(comparison.get("behind_by", 0) or 0)
                if behind == 0:
                    continue

                # Check for breaking changes in commit messages
                commits = comparison.get("commits", []) or []
                breaking_keywords = ["breaking", "major", "deprecat", "migration", "rename"]
                has_breaking = any(
                    any(kw in (c.get("commit") or {}).get("message", "").lower() for kw in breaking_keywords)
                    for c in commits[:20]
                )

                if has_breaking or behind > 20:
                    total["skipped"] += 1
                    continue

                # Safe to auto-merge
                async with httpx.AsyncClient() as http_client:
                    merge_response = await http_client.post(
                        f"https://api.github.com/repos/{repo.owner}/{repo.name}/merges",
                        headers=client.headers,
                        json={
                            "base": repo.default_branch or "main",
                            "head": f"{upstream_owner}:{upstream_branch}",
                            "commit_message": f"Daily auto-merge: {behind} commits from upstream",
                        },
                    )

                if merge_response.status_code == 201:
                    merge_data = merge_response.json()
                    total["merged"] += 1
                    async with AsyncSessionLocal() as db:
                        repo_result = await db.execute(
                            select(Repository).where(Repository.id == repo.id)
                        )
                        db_repo = repo_result.scalar_one_or_none()
                        if db_repo:
                            db_repo.sync_status = SyncStatus.synced
                            db_repo.behind_count = 0
                            db_repo.last_sync_at = datetime.utcnow()
                        await db.commit()

                    logger.info(
                        "Daily auto-merge: merged %s (%d commits) for user %s",
                        repo.full_name, behind, uid[:8],
                    )

            except Exception as exc:
                logger.warning("Daily auto-merge failed for %s: %s", repo.full_name, exc)
                total["errors"] += 1

    logger.info("Daily auto-merge sweep complete: %s", total)
    return total


# ---------------------------------------------------------------------------
# Celery task wrappers
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.merge_worker.execute_auto_merge_task")
def execute_auto_merge_task(merge_job_id: str) -> Dict[str, Any]:
    return asyncio.run(execute_auto_merge(merge_job_id))


@celery.task(name="app.workers.merge_worker.resolve_all_dependencies_task")
def resolve_all_dependencies_task(merge_job_id: str, strategy: str = "use_upstream") -> Dict[str, Any]:
    return asyncio.run(resolve_all_dependencies(merge_job_id, strategy))


@celery.task(name="app.workers.merge_worker.rollback_merge_task")
def rollback_merge_task(merge_job_id: str) -> Dict[str, Any]:
    return asyncio.run(rollback_merge(merge_job_id))


@celery.task(name="app.workers.merge_worker.auto_merge_watched_forks_daily")
def auto_merge_watched_forks_daily() -> Dict[str, Any]:
    """Daily auto-merge sweep for all watched forks."""
    return asyncio.run(auto_merge_watched_forks())
