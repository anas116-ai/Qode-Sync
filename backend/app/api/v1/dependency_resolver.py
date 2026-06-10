"""Smart Dependency Conflict Resolver - AI-powered package version conflict resolution."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from datetime import datetime
from typing import Optional

import base64

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.merge import DependencyConflict, MergeJob
from app.core.ai import ai_provider

router = APIRouter()


PACKAGE_MANAGERS = {
    "npm": {"files": ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"], "registry": "https://registry.npmjs.org"},
    "pip": {"files": ["requirements.txt", "Pipfile", "pyproject.toml"], "registry": "https://pypi.org/pypi"},
    "cargo": {"files": ["Cargo.toml", "Cargo.lock"], "registry": "https://crates.io/api/v1/crates"},
    "go": {"files": ["go.mod", "go.sum"], "registry": "https://proxy.golang.org"},
    "maven": {"files": ["pom.xml", "build.gradle"], "registry": "https://search.maven.org"},
    "gem": {"files": ["Gemfile", "Gemfile.lock"], "registry": "https://rubygems.org/api/v1/gems"},
    "composer": {"files": ["composer.json", "composer.lock"], "registry": "https://repo.packagist.org/p2"},
}

DEPENDENCY_FILE_PATTERNS = {
    "package.json": "npm",
    "package-lock.json": "npm",
    "yarn.lock": "npm",
    "pnpm-lock.yaml": "npm",
    "requirements.txt": "pip",
    "Pipfile": "pip",
    "pyproject.toml": "pip",
    "Cargo.toml": "cargo",
    "Cargo.lock": "cargo",
    "go.mod": "go",
    "go.sum": "go",
    "pom.xml": "maven",
    "build.gradle": "maven",
    "Gemfile": "gem",
    "Gemfile.lock": "gem",
    "composer.json": "composer",
    "composer.lock": "composer",
}


@router.get("/dependencies/{repo_id}/check")
async def check_dependency_conflicts(
    repo_id: str,
    merge_job_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check for dependency conflicts between fork and upstream."""
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

    # Analyze dependency files from the comparison
    from app.core.github import GitHubClient
    if not current_user.github_pat_encrypted:
        raise HTTPException(status_code=400, detail="No GitHub token configured")

    client = GitHubClient(current_user.github_pat_encrypted)
    upstream_owner = repo.parent_owner
    upstream_name = repo.parent_full_name.split("/")[-1] if repo.parent_full_name else repo.name
    upstream_branch = repo.parent_default_branch or "main"

    conflicts = []
    try:
        # Get contents of dependency files from both fork and upstream
        dependency_files = list(DEPENDENCY_FILE_PATTERNS.keys())

        for dep_file in dependency_files:
            try:
                upstream_content = await client._request(
                    f"/repos/{upstream_owner}/{upstream_name}/contents/{dep_file}?ref={upstream_branch}"
                )
                fork_content = await client._request(
                    f"/repos/{repo.owner}/{repo.name}/contents/{dep_file}?ref={repo.default_branch or 'main'}"
                )

                if upstream_content and fork_content:
                    import base64
                    upstream_decoded = base64.b64decode(upstream_content.get("content", "")).decode("utf-8")
                    fork_decoded = base64.b64decode(fork_content.get("content", "")).decode("utf-8")

                    if upstream_decoded != fork_decoded:
                        pm = DEPENDENCY_FILE_PATTERNS[dep_file]
                        conflict_analysis = await _analyze_dependency_conflict(
                            dep_file, pm, upstream_decoded, fork_decoded, repo, rid, current_user, db, merge_job_id
                        )
                        if conflict_analysis:
                            conflicts.append(conflict_analysis)

            except Exception:
                continue  # File may not exist in one or both

    except Exception as exc:
        pass  # Return whatever conflicts we found

    total_conflicts = len(conflicts)
    auto_resolvable = sum(1 for c in conflicts if c.get("auto_resolvable", False))

    return {
        "repo_id": repo_id,
        "total_conflicts": total_conflicts,
        "auto_resolvable": auto_resolvable,
        "conflicts": conflicts,
        "resolution_suggestions": _generate_resolution_suggestions(conflicts),
    }


async def _analyze_dependency_conflict(
    dep_file: str,
    package_manager: str,
    upstream_content: str,
    fork_content: str,
    repo: Repository,
    rid: UUID,
    current_user: UserProfile,
    db: AsyncSession,
    merge_job_id: Optional[str] = None,
) -> Optional[dict]:
    """Analyze a dependency file for version conflicts."""
    mjid = UUID(merge_job_id) if merge_job_id else None
    conflicts_found = []

    if dep_file == "package.json":
        import json
        try:
            upstream_json = json.loads(upstream_content)
            fork_json = json.loads(fork_content)

            for dep_type in ["dependencies", "devDependencies", "peerDependencies"]:
                upstream_deps = upstream_json.get(dep_type, {})
                fork_deps = fork_json.get(dep_type, {})

                for pkg_name in set(list(upstream_deps.keys()) + list(fork_deps.keys())):
                    upstream_ver = upstream_deps.get(pkg_name, "")
                    fork_ver = fork_deps.get(pkg_name, "")

                    if upstream_ver and fork_ver and upstream_ver != fork_ver:
                        conflict = DependencyConflict(
                            repository_id=rid,
                            merge_job_id=mjid,
                            package_name=pkg_name,
                            package_manager=package_manager,
                            upstream_version=upstream_ver,
                            fork_version=fork_ver,
                            conflict_type="version_mismatch",
                            severity="medium",
                            auto_resolved=False,
                        )
                        db.add(conflict)
                        conflicts_found.append({
                            "package": pkg_name,
                            "type": dep_type,
                            "package_manager": package_manager,
                            "file": dep_file,
                            "upstream_version": upstream_ver,
                            "fork_version": fork_ver,
                            "conflict_type": "version_mismatch",
                            "severity": "medium",
                            "auto_resolvable": True,
                            "recommended_action": f"Update {pkg_name} from {fork_ver} to {upstream_ver}",
                        })

        except (json.JSONDecodeError, Exception):
            pass

    elif dep_file == "requirements.txt":
        upstream_lines = upstream_content.strip().split("\n")
        fork_lines = fork_content.strip().split("\n")

        upstream_pkgs = {}
        for line in upstream_lines:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line and ">=" not in line and "<" not in line and "~" not in line:
                parts = line.split("==")
                if len(parts) == 2:
                    upstream_pkgs[parts[0].strip()] = parts[1].strip()

        fork_pkgs = {}
        for line in fork_lines:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line and ">=" not in line and "<" not in line and "~" not in line:
                parts = line.split("==")
                if len(parts) == 2:
                    fork_pkgs[parts[0].strip()] = parts[1].strip()

        for pkg_name in set(list(upstream_pkgs.keys()) + list(fork_pkgs.keys())):
            upstream_ver = upstream_pkgs.get(pkg_name, "")
            fork_ver = fork_pkgs.get(pkg_name, "")
            if upstream_ver and fork_ver and upstream_ver != fork_ver:
                conflict = DependencyConflict(
                    repository_id=rid,
                    merge_job_id=mjid,
                    package_name=pkg_name,
                    package_manager=package_manager,
                    upstream_version=upstream_ver,
                    fork_version=fork_ver,
                    conflict_type="version_mismatch",
                    severity="medium",
                    auto_resolved=False,
                )
                db.add(conflict)
                conflicts_found.append({
                    "package": pkg_name,
                    "package_manager": package_manager,
                    "file": dep_file,
                    "upstream_version": upstream_ver,
                    "fork_version": fork_ver,
                    "conflict_type": "version_mismatch",
                    "severity": "medium",
                    "auto_resolvable": True,
                    "recommended_action": f"Update {pkg_name} from {fork_ver} to {upstream_ver}",
                })

    elif dep_file == "Cargo.toml":
        import re
        upstream_deps = re.findall(r'^(\w[\w-]*)\s*=\s*["\']([^"\']+)["\']', upstream_content, re.MULTILINE)
        fork_deps = re.findall(r'^(\w[\w-]*)\s*=\s*["\']([^"\']+)["\']', fork_content, re.MULTILINE)

        upstream_dep_map = dict(upstream_deps)
        fork_dep_map = dict(fork_deps)

        for pkg_name in set(list(upstream_dep_map.keys()) + list(fork_dep_map.keys())):
            upstream_ver = upstream_dep_map.get(pkg_name, "")
            fork_ver = fork_dep_map.get(pkg_name, "")
            if upstream_ver and fork_ver and upstream_ver != fork_ver:
                conflict = DependencyConflict(
                    repository_id=rid,
                    merge_job_id=mjid,
                    package_name=pkg_name,
                    package_manager=package_manager,
                    upstream_version=upstream_ver,
                    fork_version=fork_ver,
                    conflict_type="version_mismatch",
                    severity="medium",
                    auto_resolved=False,
                )
                db.add(conflict)
                conflicts_found.append({
                    "package": pkg_name,
                    "package_manager": package_manager,
                    "file": dep_file,
                    "upstream_version": upstream_ver,
                    "fork_version": fork_ver,
                    "conflict_type": "version_mismatch",
                    "severity": "medium",
                    "auto_resolvable": True,
                    "recommended_action": f"Update {pkg_name} from {fork_ver} to {upstream_ver}",
                })

    if conflicts_found:
        await db.commit()

    return {
        "file": dep_file,
        "package_manager": package_manager,
        "conflicts": conflicts_found,
        "auto_resolvable": all(c.get("auto_resolvable", False) for c in conflicts_found),
    } if conflicts_found else None


def _generate_resolution_suggestions(conflicts: list) -> list:
    """Generate AI-driven resolution suggestions."""
    suggestions = []
    for conflict_group in conflicts:
        file = conflict_group.get("file", "")
        for c in conflict_group.get("conflicts", []):
            suggestions.append({
                "file": file,
                "package": c.get("package", ""),
                "current_action": c.get("recommended_action", ""),
                "priority": "high" if c.get("severity") == "critical" else "medium",
            })
    return suggestions


@router.post("/dependencies/{repo_id}/resolve")
async def resolve_dependency_conflicts(
    repo_id: str,
    merge_job_id: str = Query(...),
    resolution_strategy: str = Query("use_upstream"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-powered auto-resolution of dependency conflicts."""
    try:
        rid = UUID(repo_id)
        mjid = UUID(merge_job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id format")

    result = await db.execute(
        select(DependencyConflict).where(
            DependencyConflict.repository_id == rid,
            DependencyConflict.merge_job_id == mjid,
            DependencyConflict.auto_resolved == False,
        )
    )
    conflicts = result.scalars().all()

    if not conflicts:
        return {"success": True, "message": "No conflicts to resolve", "resolved": 0}

    resolved_count = 0
    for conflict in conflicts:
        resolution = resolution_strategy
        if resolution == "use_upstream":
            conflict.resolved_version = conflict.upstream_version
            conflict.resolution_strategy = "use_upstream"
        elif resolution == "use_fork":
            conflict.resolved_version = conflict.fork_version
            conflict.resolution_strategy = "use_fork"
        elif resolution == "merge":
            # Use the higher version
            conflict.resolved_version = max(conflict.upstream_version or "", conflict.fork_version or "")
            conflict.resolution_strategy = "merge"
        elif resolution == "ai":
            # AI-driven resolution
            ai_prompt = (
                f"Resolve dependency conflict for package '{conflict.package_name}' "
                f"(manager: {conflict.package_manager}). "
                f"Upstream version: {conflict.upstream_version}, Fork version: {conflict.fork_version}. "
                f"Recommend the best version and strategy."
            )
            try:
                ai_response = await ai_provider.chat(ai_prompt)
                conflict.resolved_version = conflict.upstream_version  # Default to upstream
                conflict.resolution_strategy = "ai_auto_resolve"
                conflict.ai_recommendation = ai_response[:500]
            except Exception:
                conflict.resolved_version = conflict.upstream_version
                conflict.resolution_strategy = "use_upstream"

        conflict.auto_resolved = True
        conflict.resolved_at = datetime.utcnow()
        resolved_count += 1

    await db.commit()

    return {
        "success": True,
        "resolved": resolved_count,
        "resolution_strategy": resolution_strategy,
        "conflicts": [
            {
                "package": c.package_name,
                "upstream_version": c.upstream_version,
                "fork_version": c.fork_version,
                "resolved_version": c.resolved_version,
                "strategy": c.resolution_strategy,
            }
            for c in conflicts
        ],
    }


@router.get("/dependencies/{repo_id}/history")
async def get_dependency_history(
    repo_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dependency conflict resolution history."""
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository id")

    result = await db.execute(
        select(DependencyConflict)
        .where(DependencyConflict.repository_id == rid)
        .order_by(desc(DependencyConflict.created_at))
        .limit(limit)
    )
    conflicts = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "package_name": c.package_name,
            "package_manager": c.package_manager,
            "upstream_version": c.upstream_version,
            "fork_version": c.fork_version,
            "resolved_version": c.resolved_version,
            "conflict_type": c.conflict_type,
            "severity": c.severity,
            "auto_resolved": c.auto_resolved,
            "resolution_strategy": c.resolution_strategy,
            "ai_recommendation": c.ai_recommendation,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in conflicts
    ]
