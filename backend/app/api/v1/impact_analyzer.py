"""Cross-Repo Impact Analyzer - Predicts upstream changes impact on forks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from typing import Optional

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.core.github import GitHubClient

router = APIRouter()


@router.get("/impact/{repo_id}")
async def analyze_impact(
    repo_id: str,
    base_branch: str = Query("main"),
    head_branch: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze the impact of upstream changes on a fork."""
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
    upstream_owner = repo.parent_owner
    upstream_name = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name
    upstream_branch = repo.parent_default_branch or "main"
    fork_branch = head_branch or repo.default_branch or "main"

    try:
        comparison = await client.compare_commits(
            repo.owner, repo.name,
            base=f"{repo.owner}:{fork_branch}",
            head=f"{upstream_owner}:{upstream_branch}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GitHub comparison failed: {exc}")

    behind = int(comparison.get("behind_by", 0) or 0)
    ahead = int(comparison.get("ahead_by", 0) or 0)
    commits = comparison.get("commits", []) or []

    # Categorize changes
    api_changes = []
    config_changes = []
    dependency_changes = []
    documentation_changes = []
    test_changes = []
    source_changes = []
    breaking_changes = []

    for commit in commits[:50]:
        commit_msg = (commit.get("commit") or {}).get("message", "").lower()
        files = commit.get("files", [])

        for file_data in files:
            filename = file_data.get("filename", "")

            if any(pattern in filename for pattern in ["api/", "graphql/", "protobuf/", "rpc/"]):
                api_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            if any(pattern in filename for pattern in [".config", ".json", ".yml", ".yaml", ".env", "Dockerfile", "docker-compose"]):
                config_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            if any(pattern in filename for pattern in ["package.json", "requirements.txt", "Cargo.toml", "go.mod", "Gemfile"]):
                dependency_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            if any(pattern in filename for pattern in ["test_", "_test.", "spec_", "_spec.", "__tests__", "test/"]):
                test_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            if any(pattern in filename for pattern in ["readme", "changelog", "docs/", ".md"]):
                documentation_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            if filename.endswith((".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".rb", ".php", ".c", ".cpp", ".h", ".hpp")):
                source_changes.append({
                    "file": filename,
                    "status": file_data.get("status"),
                    "additions": file_data.get("additions", 0),
                    "deletions": file_data.get("deletions", 0),
                })

            # Detect breaking changes
            if any(pattern in filename for pattern in ["migration", "schema", "database", "db/"]) or "break" in commit_msg or "migration" in commit_msg:
                breaking_changes.append({
                    "file": filename,
                    "reason": "Database schema change" if "schema" in filename or "migration" in filename else "Breaking change indicator",
                    "severity": "high",
                })

    total_additions = sum(c.get("additions", 0) for c in commits)
    total_deletions = sum(c.get("deletions", 0) for c in commits)
    total_files = len(set(
        f.get("filename", "") for c in commits for f in (c.get("files", []) or [])
    ))

    impact_score = min(100, (
        behind * 2 +
        total_additions * 0.1 +
        total_deletions * 0.05 +
        len(api_changes) * 5 +
        len(breaking_changes) * 10 +
        len(config_changes) * 3
    ))

    return {
        "repo_id": repo_id,
        "repo_name": repo.full_name,
        "upstream": repo.parent_full_name,
        "impact_score": min(100, impact_score),
        "behind_count": behind,
        "ahead_count": ahead,
        "total_commits": len(commits),
        "total_files_changed": total_files,
        "total_additions": total_additions,
        "total_deletions": total_deletions,
        "categorized_changes": {
            "api_changes": {
                "count": len(api_changes),
                "files": api_changes[:10],
            },
            "config_changes": {
                "count": len(config_changes),
                "files": config_changes[:10],
            },
            "dependency_changes": {
                "count": len(dependency_changes),
                "files": dependency_changes[:10],
            },
            "test_changes": {
                "count": len(test_changes),
                "files": test_changes[:10],
            },
            "documentation_changes": {
                "count": len(documentation_changes),
                "files": documentation_changes[:10],
            },
            "source_code_changes": {
                "count": len(source_changes),
                "files": source_changes[:10],
            },
            "breaking_changes": {
                "count": len(breaking_changes),
                "details": breaking_changes[:10],
            },
        },
        "action_recommendation": (
            "Safe to auto-merge" if impact_score < 30 else
            "Review recommended before merge" if impact_score < 60 else
            "Manual review required - high risk of conflicts"
        ),
    }


@router.get("/impact/cross-repo/{upstream_name}")
async def analyze_cross_repo_impact(
    upstream_name: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze how upstream changes affect ALL forks of that upstream."""
    repo_result = await db.execute(
        select(Repository).where(
            Repository.user_id == current_user.id,
            Repository.parent_full_name == upstream_name,
        )
    )
    forks = repo_result.scalars().all()

    if not forks:
        raise HTTPException(status_code=404, detail="No forks found for this upstream")

    impacts = []
    for fork in forks:
        try:
            impact = await analyze_impact(str(fork.id), current_user=current_user, db=db)
            impacts.append({
                "fork_id": str(fork.id),
                "fork_name": fork.full_name,
                "impact_score": impact["impact_score"],
                "behind_count": impact["behind_count"],
                "breaking_changes": impact["categorized_changes"]["breaking_changes"]["count"],
                "recommendation": impact["action_recommendation"],
            })
        except Exception:
            impacts.append({
                "fork_id": str(fork.id),
                "fork_name": fork.full_name,
                "impact_score": 0,
                "behind_count": 0,
                "error": "Failed to analyze",
            })

    total_impact = sum(i.get("impact_score", 0) for i in impacts)
    avg_impact = total_impact / len(impacts) if impacts else 0

    return {
        "upstream": upstream_name,
        "total_forks": len(forks),
        "average_impact_score": round(avg_impact, 1),
        "total_breaking_across_forks": sum(i.get("breaking_changes", 0) for i in impacts),
        "fork_impacts": impacts,
    }
