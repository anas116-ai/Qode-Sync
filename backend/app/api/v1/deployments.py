"""GitOps Deployment Automation - Sync-triggered deployments to Kubernetes/Cloud."""
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
from app.models.deployment import DeploymentConfig, Deployment, DeploymentStatus, DeploymentProvider
from app.models.sync import SyncJob

router = APIRouter()


@router.post("/deployment-configs")
async def create_deployment_config(
    repo_id: str,
    name: str,
    provider: str = Query(...),
    target_branch: str = Query("main"),
    auto_deploy: bool = Query(False),
    deploy_on_sync: bool = Query(False),
    environment: str = Query("production"),
    health_check_endpoint: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a deployment configuration for a repository."""
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository id")

    repo_result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    if not repo_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        provider_enum = DeploymentProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    config = DeploymentConfig(
        user_id=current_user.id,
        repository_id=rid,
        name=name,
        provider=provider_enum,
        target_branch=target_branch,
        auto_deploy=auto_deploy,
        deploy_on_sync=deploy_on_sync,
        environment=environment,
        health_check_endpoint=health_check_endpoint,
        rollback_on_failure=True,
        notify_on_success=True,
        notify_on_failure=True,
        enabled=True,
        config={},
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return {
        "id": str(config.id),
        "name": config.name,
        "provider": config.provider.value,
        "target_branch": config.target_branch,
        "auto_deploy": config.auto_deploy,
        "deploy_on_sync": config.deploy_on_sync,
        "environment": config.environment,
        "health_check_endpoint": config.health_check_endpoint,
        "enabled": config.enabled,
    }


@router.get("/deployment-configs")
async def list_deployment_configs(
    repo_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List deployment configurations."""
    query = select(DeploymentConfig).where(DeploymentConfig.user_id == current_user.id)
    if repo_id:
        try:
            query = query.where(DeploymentConfig.repository_id == UUID(repo_id))
        except ValueError:
            pass

    result = await db.execute(query)
    configs = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "repository_id": str(c.repository_id),
            "name": c.name,
            "provider": c.provider.value,
            "target_branch": c.target_branch,
            "auto_deploy": c.auto_deploy,
            "deploy_on_sync": c.deploy_on_sync,
            "environment": c.environment,
            "health_check_endpoint": c.health_check_endpoint,
            "enabled": c.enabled,
            "last_deployed_at": c.last_deployed_at.isoformat() if c.last_deployed_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in configs
    ]


@router.post("/deployments/{config_id}/trigger")
async def trigger_deployment(
    config_id: str,
    commit_sha: Optional[str] = Query(None),
    merge_job_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a deployment for a config."""
    try:
        cid = UUID(config_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid config id")

    result = await db.execute(
        select(DeploymentConfig).where(DeploymentConfig.id == cid, DeploymentConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Deployment config not found")

    mjid = UUID(merge_job_id) if merge_job_id else None
    version = f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    deployment = Deployment(
        config_id=cid,
        user_id=current_user.id,
        repository_id=config.repository_id,
        merge_job_id=mjid,
        version=version,
        status=DeploymentStatus.deploying,
        commit_sha=commit_sha,
        started_at=datetime.utcnow(),
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    # Simulate deployment (in production, this would be a background task)
    import random
    mock_duration = random.randint(5000, 30000)

    deployment.status = DeploymentStatus.healthy
    deployment.duration_ms = mock_duration
    deployment.external_url = f"https://{config.name}-{config.environment}.example.com"
    deployment.logs = [
        {"time": datetime.utcnow().isoformat(), "message": f"Deploying version {version}..."},
        {"time": datetime.utcnow().isoformat(), "message": "Building container image..."},
        {"time": datetime.utcnow().isoformat(), "message": "Pushing to registry..."},
        {"time": datetime.utcnow().isoformat(), "message": f"Rolling out to {config.environment}..."},
        {"time": datetime.utcnow().isoformat(), "message": "Health check passed"},
        {"time": datetime.utcnow().isoformat(), "message": f"Deployment {version} completed in {mock_duration}ms"},
    ]
    deployment.completed_at = datetime.utcnow()
    config.last_deployed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deployment)

    return {
        "id": str(deployment.id),
        "version": deployment.version,
        "status": deployment.status.value,
        "duration_ms": deployment.duration_ms,
        "external_url": deployment.external_url,
        "logs": deployment.logs,
    }


@router.get("/deployments")
async def list_deployments(
    config_id: Optional[str] = Query(None),
    repo_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List deployment records."""
    query = select(Deployment).where(Deployment.user_id == current_user.id)
    if config_id:
        try:
            query = query.where(Deployment.config_id == UUID(config_id))
        except ValueError:
            pass
    if repo_id:
        try:
            query = query.where(Deployment.repository_id == UUID(repo_id))
        except ValueError:
            pass
    query = query.order_by(desc(Deployment.created_at)).limit(limit)

    result = await db.execute(query)
    deployments = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "config_id": str(d.config_id),
            "repository_id": str(d.repository_id),
            "version": d.version,
            "status": d.status.value,
            "commit_sha": d.commit_sha,
            "duration_ms": d.duration_ms,
            "external_url": d.external_url,
            "rollout_percentage": d.rollout_percentage,
            "started_at": d.started_at.isoformat() if d.started_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in deployments
    ]


@router.get("/deployments/{deployment_id}")
async def get_deployment(
    deployment_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed deployment information."""
    try:
        did = UUID(deployment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deployment id")

    result = await db.execute(
        select(Deployment).where(Deployment.id == did, Deployment.user_id == current_user.id)
    )
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {
        "id": str(deployment.id),
        "config_id": str(deployment.config_id),
        "repository_id": str(deployment.repository_id),
        "merge_job_id": str(deployment.merge_job_id) if deployment.merge_job_id else None,
        "version": deployment.version,
        "status": deployment.status.value,
        "commit_sha": deployment.commit_sha,
        "rollout_percentage": deployment.rollout_percentage,
        "duration_ms": deployment.duration_ms,
        "logs": deployment.logs,
        "error_message": deployment.error_message,
        "external_url": deployment.external_url,
        "started_at": deployment.started_at.isoformat() if deployment.started_at else None,
        "completed_at": deployment.completed_at.isoformat() if deployment.completed_at else None,
        "created_at": deployment.created_at.isoformat() if deployment.created_at else None,
    }
