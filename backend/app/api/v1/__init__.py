"""API v1 router aggregator."""
from fastapi import APIRouter
from app.api.v1 import (
    auth,
    repositories,
    updates,
    notifications,
    notifications_v2,
    analytics,
    sync,
    webhooks,
    teams,
    audit,
    ai,
    bookmarks,
    auto_merge,
    dependency_resolver,
    impact_analyzer,
    patches,
    backport,
    testing,
    deployments,
    sync_network,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(repositories.router, prefix="/repositories", tags=["repositories"])
api_router.include_router(updates.router, prefix="/updates", tags=["updates"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(notifications_v2.router, prefix="/notifications", tags=["notifications-v2"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(bookmarks.router, prefix="/repositories", tags=["bookmarks"])
api_router.include_router(auto_merge.router, prefix="/auto-merge", tags=["auto-merge"])
api_router.include_router(dependency_resolver.router, prefix="/auto-merge", tags=["dependency-resolver"])
api_router.include_router(impact_analyzer.router, prefix="/auto-merge", tags=["impact-analyzer"])
api_router.include_router(patches.router, prefix="/auto-merge", tags=["patches"])
api_router.include_router(backport.router, prefix="/auto-merge", tags=["backport"])
api_router.include_router(testing.router, prefix="/auto-merge", tags=["testing"])
api_router.include_router(deployments.router, prefix="/auto-merge", tags=["deployments"])
api_router.include_router(sync_network.router, prefix="/auto-merge", tags=["sync-network"])
