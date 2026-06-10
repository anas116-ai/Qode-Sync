"""Celery tasks for GitOps deployment automation and sync-triggered deployments."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict
import random

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.deployment import DeploymentConfig, Deployment, DeploymentStatus
from app.workers.task_schedule import celery

logger = logging.getLogger("forktracker.deploy")


async def execute_deployment(config_id: str, commit_sha: str = None) -> Dict[str, Any]:
    """Execute a deployment for a configuration (simulated)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DeploymentConfig).where(DeploymentConfig.id == config_id)
        )
        config = result.scalar_one_or_none()
        if not config:
            return {"ok": False, "reason": "config_not_found"}

        version = f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        deployment = Deployment(
            config_id=config.id,
            user_id=config.user_id,
            repository_id=config.repository_id,
            version=version,
            status=DeploymentStatus.deploying,
            commit_sha=commit_sha,
            started_at=datetime.utcnow(),
        )
        db.add(deployment)
        await db.flush()

        try:
            mock_duration = random.randint(5000, 60000)
            deployment.status = DeploymentStatus.healthy
            deployment.duration_ms = mock_duration
            deployment.external_url = f"https://{config.name}-{config.environment}.example.com"
            deployment.logs = [
                {"time": datetime.utcnow().isoformat(), "message": f"Deploying version {version}..."},
                {"time": datetime.utcnow().isoformat(), "message": "Building container image..."},
                {"time": datetime.utcnow().isoformat(), "message": "Pushing to registry..."},
                {"time": datetime.utcnow().isoformat(), "message": f"Rolling out to {config.environment}..."},
                {"time": datetime.utcnow().isoformat(), "message": "Health check passed ✓"},
                {"time": datetime.utcnow().isoformat(), "message": f"Deployment {version} completed in {mock_duration}ms"},
            ]
            deployment.completed_at = datetime.utcnow()
            config.last_deployed_at = datetime.utcnow()

        except Exception as exc:
            deployment.status = DeploymentStatus.failed
            deployment.error_message = str(exc)[:500]
            deployment.logs = [{"time": datetime.utcnow().isoformat(), "message": f"Deployment failed: {exc}"}]
            deployment.completed_at = datetime.utcnow()

        await db.commit()
        return {
            "ok": deployment.status == DeploymentStatus.healthy,
            "status": deployment.status.value,
            "version": version,
            "external_url": deployment.external_url,
            "duration_ms": deployment.duration_ms,
        }


@celery.task(name="app.workers.deploy_worker.execute_deployment_task")
def execute_deployment_task(config_id: str, commit_sha: str = None) -> Dict[str, Any]:
    return asyncio.run(execute_deployment(config_id, commit_sha))
