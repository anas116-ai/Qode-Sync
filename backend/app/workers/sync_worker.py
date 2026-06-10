"""Celery tasks that synchronize forked repositories and detect upstream updates.

The async coroutines are exported for in-process use (tests, scripts) AND
wrapped in ``asyncio.run`` from the Celery task entry points so the worker
processes (which are sync) can call them safely.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import select

from app.config import settings
from app.core.ai import ai_provider
from app.core.github import GitHubClient, GitHubRateLimitError
from app.database import AsyncSessionLocal
from app.models.repository import Repository, SyncStatus
from app.models.sync import SyncJob, SyncJobStatus
from app.models.update import Update, UpdateSeverity, UpdateType
from app.models.user import UserProfile, TokenStatus
from app.workers.task_schedule import celery

logger = logging.getLogger("forktracker.sync")


# ---------------------------------------------------------------------------
# Async coroutines (testable in-process)
# ---------------------------------------------------------------------------
async def sync_user_forks(user_id: str) -> Dict[str, int]:
    """Discover and refresh every fork for ``user_id``. Returns counters."""
    counters = {"created": 0, "updated": 0, "updates_created": 0, "errors": 0}

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
        profile = result.scalar_one_or_none()
        if profile is None:
            logger.warning("sync_user_forks: user %s not found", user_id)
            return counters
        if not profile.github_pat_encrypted:
            logger.info("sync_user_forks: user %s has no PAT", user_id)
            return counters

        try:
            client = GitHubClient(profile.github_pat_encrypted)
            forks = await client.get_forks()
        except GitHubRateLimitError as e:
            logger.warning("GitHub rate limit hit for user %s (retry in %ss)", user_id, e.retry_after)
            profile.token_status = TokenStatus.valid  # still valid, just throttled
            await db.commit()
            return counters
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to fetch forks for %s: %s", user_id, exc)
            counters["errors"] += 1
            return counters

        for fork_data in forks:
            try:
                await _process_fork(db, profile, client, fork_data, counters)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Error processing fork %s: %s", fork_data.get("full_name"), exc)
                counters["errors"] += 1

        profile.last_sync_at = datetime.utcnow()
        await db.commit()
    return counters


async def _process_fork(
    db,
    profile: UserProfile,
    client: GitHubClient,
    fork_data: Dict[str, Any],
    counters: Dict[str, int],
) -> None:
    """Upsert a single fork and compare it to its parent."""
    parent = fork_data.get("parent") or {}

    repo_result = await db.execute(
        select(Repository).where(Repository.github_id == fork_data["id"])
    )
    repo = repo_result.scalar_one_or_none()

    if repo is None:
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
            default_branch=fork_data.get("default_branch", "main"),
            stars_count=fork_data.get("stargazers_count", 0),
            forks_count=fork_data.get("forks_count", 0),
            open_issues_count=fork_data.get("open_issues_count", 0),
            parent_github_id=parent.get("id"),
            parent_full_name=parent.get("full_name"),
            parent_owner=(parent.get("owner") or {}).get("login"),
            parent_default_branch=parent.get("default_branch", "main"),
        )
        db.add(repo)
        await db.flush()  # populate repo.id
        counters["created"] += 1
    else:
        counters["updated"] += 1
        # refresh mutable fields
        repo.archived = fork_data.get("archived", repo.archived)
        repo.stars_count = fork_data.get("stargazers_count", repo.stars_count)
        repo.forks_count = fork_data.get("forks_count", repo.forks_count)
        repo.open_issues_count = fork_data.get(
            "open_issues_count", repo.open_issues_count
        )
        repo.description = fork_data.get("description", repo.description)
        repo.language = fork_data.get("language", repo.language)
        repo.default_branch = fork_data.get("default_branch", repo.default_branch)

    # --- compare to upstream -------------------------------------------------
    parent_login = (parent.get("owner") or {}).get("login")
    parent_name = parent.get("name")
    if parent_login and parent_name:
        try:
            comparison = await client.compare_commits(
                repo.owner,
                repo.name,
                base=f"{repo.owner}:{repo.default_branch}",
                head=f"{parent_login}:{parent.get('default_branch', 'main')}",
            )
            ahead = int(comparison.get("ahead_by", 0) or 0)
            behind = int(comparison.get("behind_by", 0) or 0)

            repo.ahead_count = ahead
            repo.behind_count = behind
            repo.divergence_count = ahead + behind
            if behind > 0 and ahead > 0:
                repo.sync_status = SyncStatus.diverged
            elif behind > 0:
                repo.sync_status = SyncStatus.behind
            elif ahead > 0:
                repo.sync_status = SyncStatus.ahead
            else:
                repo.sync_status = SyncStatus.synced

            if behind > 0:
                commits: List[Dict[str, Any]] = comparison.get("commits", []) or []
                summary = await ai_provider.summarize_commits(commits[:10])
                severity = (
                    UpdateSeverity.high
                    if behind > 10
                    else UpdateSeverity.medium
                    if behind > 3
                    else UpdateSeverity.low
                )
                update = Update(
                    repository_id=repo.id,
                    user_id=profile.id,
                    update_type=UpdateType.commit,
                    title=f"{behind} new commits in upstream",
                    description=(
                        f"Your fork is {behind} commits behind "
                        f"{parent.get('full_name')}"
                    ),
                    severity=severity,
                    ai_summary=summary.get("short"),
                    ai_summary_detailed=summary.get("detailed"),
                    metadata={"ahead_by": ahead, "behind_by": behind},
                )
                db.add(update)
                counters["updates_created"] += 1
        except GitHubRateLimitError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("compare_commits failed for %s: %s", repo.full_name, exc)
            repo.sync_status = SyncStatus.unknown

        # --- releases --------------------------------------------------------
        try:
            releases = await client.get_releases(parent_login, parent_name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("get_releases failed for %s: %s", parent.get("full_name"), exc)
            releases = []

        for rel in (releases or [])[:3]:
            release = Update(
                repository_id=repo.id,
                user_id=profile.id,
                update_type=UpdateType.release,
                title=f"New release: {rel.get('tag_name')}",
                description=(rel.get("body") or "")[:500],
                github_url=rel.get("html_url"),
                severity=UpdateSeverity.medium,
            )
            db.add(release)
            counters["updates_created"] += 1

    repo.last_sync_at = datetime.utcnow()
    await db.flush()


async def sync_all_users_forks() -> Dict[str, int]:
    """Iterate every user with a valid PAT and refresh their forks."""
    total = {"created": 0, "updated": 0, "updates_created": 0, "errors": 0}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.token_status == TokenStatus.valid)
        )
        profiles = result.scalars().all()
        user_ids = [str(p.id) for p in profiles]

    for uid in user_ids:
        try:
            sub = await sync_user_forks(uid)
            for k, v in sub.items():
                total[k] = total.get(k, 0) + v
        except Exception as exc:  # noqa: BLE001
            logger.exception("sync_user_forks failed for %s: %s", uid, exc)
            total["errors"] += 1
    return total


# ---------------------------------------------------------------------------
# Celery task wrappers (sync entry points)
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.sync_worker.sync_all_users_forks_task")
def sync_all_users_forks_task() -> Dict[str, int]:
    """Celery-friendly wrapper for :func:`sync_all_users_forks`."""
    return asyncio.run(sync_all_users_forks())


@celery.task(name="app.workers.sync_worker.sync_user_forks_task")
def sync_user_forks_task(user_id: str) -> Dict[str, int]:
    return asyncio.run(sync_user_forks(user_id))


@celery.task(name="app.workers.sync_worker.sync_repository_task")
def sync_repository_task(user_id: str, repository_id: str) -> Dict[str, int]:
    """On-demand single-fork sync (used by API)."""
    async def _run() -> Dict[str, int]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Repository).where(Repository.id == repository_id)
            )
            repo = result.scalar_one_or_none()
            if repo is None:
                return {"errors": 1}

            profile_result = await db.execute(
                select(UserProfile).where(UserProfile.id == user_id)
            )
            profile = profile_result.scalar_one_or_none()
            if profile is None or not profile.github_pat_encrypted:
                return {"errors": 1}

            client = GitHubClient(profile.github_pat_encrypted)
            fork_data = await client.get_repo(repo.owner, repo.name)
            fork_data["parent"] = {
                "id": repo.parent_github_id,
                "full_name": repo.parent_full_name,
                "owner": {"login": repo.parent_owner} if repo.parent_owner else {},
                "default_branch": repo.parent_default_branch,
            }
            counters: Dict[str, int] = {"created": 0, "updated": 1, "updates_created": 0, "errors": 0}
            await _process_fork(db, profile, client, fork_data, counters)
            await db.commit()
            return counters

    return asyncio.run(_run())


# Backwards-compat shim: the schedule module references
# ``app.workers.sync_worker.sync_all_users_forks`` as a Celery task name.
# Keep an attribute with that name pointing at the Celery task so older
# imports still resolve to a Celery task.
sync_all_users_forks = sync_all_users_forks_task  # type: ignore[assignment]
