"""Semantic Backporting - Selectively backport feature branches to upstream."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.merge import MergeJob, MergeStatus
from app.core.github import GitHubClient

router = APIRouter()


@router.post("/backport/{repo_id}/analyze")
async def analyze_backport(
    repo_id: str,
    feature_branch: str = Query(...),
    target_upstream_branch: str = Query("main"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze which commits can be safely backported to upstream."""
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
        # Compare feature branch with upstream
        upstream_owner = repo.parent_owner
        upstream_name = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name

        comparison = await client.compare_commits(
            repo.owner, repo.name,
            base=f"{upstream_owner}:{target_upstream_branch}",
            head=f"{repo.owner}:{feature_branch}",
        )

        ahead = int(comparison.get("ahead_by", 0) or 0)
        commits = comparison.get("commits", []) or []

        # Categorize commits for backporting
        backportable = []
        non_backportable = []

        for commit in commits[:50]:
            commit_msg = (commit.get("commit") or {}).get("message", "").lower()
            sha = commit.get("sha", "")[:8]

            # Determine if commit is backportable
            is_backportable = True
            reasons = []

            if "merge" in commit_msg and "pull request" in commit_msg:
                reasons.append("Merge commit - may include multiple changes")
                is_backportable = False
            if "wip" in commit_msg or "work in progress" in commit_msg:
                reasons.append("WIP commit")
                is_backportable = False
            if "revert" in commit_msg:
                reasons.append("Revert commit - depends on reverted changes")
                is_backportable = False
            if "fixup" in commit_msg or "squash" in commit_msg:
                reasons.append("Fixup/squash commit")
                is_backportable = False

            entry = {
                "sha": sha,
                "message": commit.get("commit", {}).get("message", ""),
                "author": commit.get("commit", {}).get("author", {}).get("name", ""),
                "date": commit.get("commit", {}).get("author", {}).get("date", ""),
                "is_backportable": is_backportable,
                "reasons": reasons,
                "files_changed": len(commit.get("files", []) or []),
            }

            if is_backportable:
                backportable.append(entry)
            else:
                non_backportable.append(entry)

        return {
            "repo_id": repo_id,
            "repo_name": repo.full_name,
            "upstream": repo.parent_full_name,
            "feature_branch": feature_branch,
            "target_upstream_branch": target_upstream_branch,
            "total_ahead_commits": ahead,
            "backportable_count": len(backportable),
            "non_backportable_count": len(non_backportable),
            "backportable_commits": backportable[:20],
            "non_backportable_commits": non_backportable[:10],
            "recommendation": (
                f"Safe to backport {len(backportable)} of {ahead} commits"
                if backportable
                else "No commits available for backporting"
            ),
        }

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Backport analysis failed: {exc}")


@router.post("/backport/{repo_id}/execute")
async def execute_backport(
    repo_id: str,
    feature_branch: str = Query(...),
    target_upstream_branch: str = Query("main"),
    commit_shas: str = Query(...),  # Comma-separated SHAs to backport
    create_pr: bool = Query(True),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute selective backport of commits to upstream via PR."""
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
    selected_shas = [s.strip() for s in commit_shas.split(",") if s.strip()]

    if not selected_shas:
        raise HTTPException(status_code=400, detail="No commit SHAs provided")

    # Create a backport branch
    backport_branch = f"backport-{feature_branch}-{datetime.utcnow().strftime('%Y%m%d')}"

    try:
        import httpx

        # Get the current state of target upstream branch
        upstream_owner = repo.parent_owner
        upstream_name = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name

        # Get base branch SHA
        import httpx
        async with httpx.AsyncClient() as http_client:
            base_ref_response = await http_client.get(
                f"https://api.github.com/repos/{repo.owner}/{repo.name}/git/refs/heads/{target_upstream_branch}",
                headers=client.headers,
            )
        if base_ref_response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Failed to get base ref: {base_ref_response.text[:200]}")
        base_sha = base_ref_response.json().get("object", {}).get("sha", "")

        # Create new branch
        async with httpx.AsyncClient() as http_client:
            branch_response = await http_client.post(
                f"https://api.github.com/repos/{repo.owner}/{repo.name}/git/refs",
                headers=client.headers,
                json={
                    "ref": f"refs/heads/{backport_branch}",
                    "sha": base_sha,
                },
            )

        if branch_response.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"Failed to create backport branch: {branch_response.text[:200]}")

        # Cherry-pick commits
        cherry_pick_results = []
        for sha in selected_shas[:10]:  # Limit to 10 commits
            try:
                async with httpx.AsyncClient() as http_client:
                    cp_response = await http_client.post(
                        f"https://api.github.com/repos/{repo.owner}/{repo.name}/git/cherry-pick",
                        headers=client.headers,
                        json={
                            "head": backport_branch,
                            "commits": [sha],
                        },
                    )

                if cp_response.status_code in (200, 201):
                    cherry_pick_results.append({"sha": sha, "status": "cherry_picked"})
                else:
                    cherry_pick_results.append({"sha": sha, "status": "failed", "error": cp_response.text[:100]})

            except Exception as exc:
                cherry_pick_results.append({"sha": sha, "status": "error", "error": str(exc)[:100]})

        # Create PR if requested
        pr_url = None
        pr_number = None

        if create_pr:
            upstream_full_name = repo.parent_full_name or f"{upstream_owner}/{upstream_name}"
            pr_body = (
                f"## Backport from {feature_branch}\n\n"
                f"Automated backport of selected commits to `{target_upstream_branch}`.\n\n"
                f"### Commits backported\n"
            )
            for result in cherry_pick_results:
                pr_body += f"- `{result['sha']}`: {result['status']}\n"

            async with httpx.AsyncClient() as http_client:
                pr_response = await http_client.post(
                    f"https://api.github.com/repos/{repo.owner}/{repo.name}/pulls",
                    headers=client.headers,
                    json={
                        "title": f"[Backport] Selective backport from {feature_branch}",
                        "head": backport_branch,
                        "base": target_upstream_branch,
                        "body": pr_body,
                        "maintainer_can_modify": True,
                    },
                )

            if pr_response.status_code in (200, 201):
                pr_data = pr_response.json()
                pr_url = pr_data.get("html_url", "")
                pr_number = pr_data.get("number", "")

        # Create merge job record
        merge_job = MergeJob(
            user_id=current_user.id,
            repository_id=rid,
            status=MergeStatus.completed if not pr_url else MergeStatus.pending,
            base_branch=target_upstream_branch,
            head_branch=backport_branch,
            ahead_commits=len(cherry_pick_results),
            behind_commits=0,
            auto_resolved=True,
        )
        db.add(merge_job)
        await db.commit()

        return {
            "success": True,
            "backport_branch": backport_branch,
            "cherry_picked_commits": len([r for r in cherry_pick_results if r["status"] == "cherry_picked"]),
            "failed_commits": [r for r in cherry_pick_results if r["status"] != "cherry_picked"],
            "pr_created": create_pr and pr_url is not None,
            "pr_url": pr_url,
            "pr_number": pr_number,
            "merge_job_id": str(merge_job.id),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Backport execution failed: {exc}")
