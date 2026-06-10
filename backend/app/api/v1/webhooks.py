"""GitHub webhook receiver endpoints."""
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hmac
import hashlib
import json

from app.config import settings
from app.database import get_db
from app.models.repository import Repository
from app.models.update import Update, UpdateType, UpdateSeverity
from app.models.audit import AuditLog, AuditAction

router = APIRouter()


def _verify_signature(secret: str, body: bytes, signature: str) -> bool:
    """Verify a GitHub webhook signature (X-Hub-Signature-256)."""
    if not signature or not signature.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256)
    expected = "sha256=" + mac.hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    if settings.GITHUB_WEBHOOK_SECRET:
        if not _verify_signature(settings.GITHUB_WEBHOOK_SECRET, body, x_hub_signature_256 or ""):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    repo_full = payload.get("repository", {}).get("full_name", "")

    # Find a matching tracked repository across all users
    result = await db.execute(
        select(Repository).where(
            (Repository.parent_full_name == repo_full) | (Repository.full_name == repo_full)
        )
    )
    repos = result.scalars().all()

    if x_github_event == "push":
        for repo in repos:
            # Create the update record
            update = Update(
                repository_id=repo.id,
                user_id=repo.user_id,
                update_type=UpdateType.commit,
                title=f"New push to {repo_full}",
                description=payload.get("head_commit", {}).get("message", "")[:500],
                github_sha=payload.get("head_commit", {}).get("id"),
                github_url=payload.get("head_commit", {}).get("url"),
                author=payload.get("head_commit", {}).get("author", {}).get("name"),
                severity=UpdateSeverity.medium,
                metadata={"ref": payload.get("ref")},
            )
            db.add(update)
            await db.flush()

            # Auto-trigger merge for forks tracking this upstream repo
            # Only merge if the fork is NOT the same as the upstream (repo.full_name != repo_full)
            if repo.full_name != repo_full and repo.is_fork:
                # Queue the merge via creating a merge job for automated assessment
                from app.models.merge import MergeJob, MergeStatus
                from app.models.user import UserProfile
                user_result = await db.execute(
                    select(UserProfile).where(UserProfile.id == repo.user_id)
                )
                user_profile = user_result.scalar_one_or_none()
                if user_profile and user_profile.github_pat_encrypted and repo.parent_full_name == repo_full:
                    merge_job = MergeJob(
                        user_id=repo.user_id,
                        repository_id=repo.id,
                        status=MergeStatus.pending,
                        base_branch=repo.default_branch or "main",
                        head_branch=repo.parent_default_branch or "main",
                        behind_commits=1,  # At least 1 new commit
                        ahead_commits=0,
                    )
                    db.add(merge_job)
                    # Log the auto-merge trigger
                    auto_merge_audit = AuditLog(
                        user_id=repo.user_id,
                        action=AuditAction.repository_sync,
                        resource_type="merge_job",
                        resource_id=None,
                        details={
                            "trigger": "webhook_push",
                            "repo": repo.full_name,
                            "upstream": repo_full,
                            "auto_queued": True,
                        },
                    )
                    db.add(auto_merge_audit)
    elif x_github_event == "release" and payload.get("action") == "published":
        release = payload.get("release", {})
        for repo in repos:
            update = Update(
                repository_id=repo.id,
                user_id=repo.user_id,
                update_type=UpdateType.release,
                title=f"New release: {release.get('tag_name')}",
                description=release.get("body", "")[:500] if release.get("body") else None,
                github_url=release.get("html_url"),
                severity=UpdateSeverity.high,
            )
            db.add(update)
    elif x_github_event == "create" and payload.get("ref_type") == "tag":
        for repo in repos:
            update = Update(
                repository_id=repo.id,
                user_id=repo.user_id,
                update_type=UpdateType.tag,
                title=f"New tag: {payload.get('ref')}",
                severity=UpdateSeverity.low,
            )
            db.add(update)
    elif x_github_event == "security_advisory":
        adv = payload.get("security_advisory", {})
        for repo in repos:
            update = Update(
                repository_id=repo.id,
                user_id=repo.user_id,
                update_type=UpdateType.security_advisory,
                title=f"Security advisory: {adv.get('summary', 'Unknown')}",
                description=adv.get("description", "")[:500],
                severity=UpdateSeverity.critical,
                github_url=adv.get("html_url"),
                metadata={"cve_id": adv.get("cve_id"), "severity": adv.get("severity")},
            )
            db.add(update)

    # Audit log
    log = AuditLog(
        action=AuditAction.webhook_received,
        resource_type="repository",
        resource_id=repos[0].id if repos else None,
        details={"event": x_github_event, "repo": repo_full},
    )
    db.add(log)
    await db.commit()
    return {"received": True, "event": x_github_event, "matched_repos": len(repos)}
