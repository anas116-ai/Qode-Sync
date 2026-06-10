"""Federated Sync Network - Auto-sync network between multiple forks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.sync_network import SyncNetwork, SyncNetworkNode, SyncNetworkEvent, NetworkStatus
from app.models.merge import MergeJob

router = APIRouter()


@router.post("/sync-networks")
async def create_sync_network(
    name: str,
    description: Optional[str] = None,
    sync_frequency: str = Query("daily"),
    conflict_strategy: str = Query("auto_ai"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new federated sync network."""
    network = SyncNetwork(
        user_id=current_user.id,
        name=name,
        description=description,
        sync_frequency=sync_frequency,
        conflict_strategy=conflict_strategy,
        status=NetworkStatus.active,
    )
    db.add(network)
    await db.commit()
    await db.refresh(network)

    return {
        "id": str(network.id),
        "name": network.name,
        "description": network.description,
        "sync_frequency": network.sync_frequency,
        "conflict_strategy": network.conflict_strategy,
        "status": network.status.value,
    }


@router.get("/sync-networks")
async def list_sync_networks(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sync networks for the user."""
    result = await db.execute(
        select(SyncNetwork).where(SyncNetwork.user_id == current_user.id)
    )
    networks = result.scalars().all()

    network_list = []
    for network in networks:
        node_count_result = await db.execute(
            select(SyncNetworkNode).where(SyncNetworkNode.network_id == network.id)
        )
        nodes = node_count_result.scalars().all()

        network_list.append({
            "id": str(network.id),
            "name": network.name,
            "description": network.description,
            "status": network.status.value,
            "sync_frequency": network.sync_frequency,
            "conflict_strategy": network.conflict_strategy,
            "node_count": len(nodes),
            "last_sync_at": network.last_sync_at.isoformat() if network.last_sync_at else None,
            "created_at": network.created_at.isoformat() if network.created_at else None,
        })

    return network_list


@router.post("/sync-networks/{network_id}/nodes")
async def add_network_node(
    network_id: str,
    repo_id: str,
    is_upstream: bool = Query(False),
    auto_merge: bool = Query(True),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a repository to a sync network."""
    try:
        nid = UUID(network_id)
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id format")

    network_result = await db.execute(
        select(SyncNetwork).where(SyncNetwork.id == nid, SyncNetwork.user_id == current_user.id)
    )
    network = network_result.scalar_one_or_none()
    if not network:
        raise HTTPException(status_code=404, detail="Sync network not found")

    repo_result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    if not repo_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Check if already added
    existing = await db.execute(
        select(SyncNetworkNode).where(
            and_(SyncNetworkNode.network_id == nid, SyncNetworkNode.repository_id == rid)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Node already exists in network")

    node = SyncNetworkNode(
        network_id=nid,
        repository_id=rid,
        is_upstream=is_upstream,
        auto_merge=auto_merge,
        sync_enabled=True,
    )
    db.add(node)

    # Log event
    event = SyncNetworkEvent(
        network_id=nid,
        event_type="node_added",
        target_repo_id=rid,
        details={"is_upstream": is_upstream, "auto_merge": auto_merge},
    )
    db.add(event)
    await db.commit()
    await db.refresh(node)

    return {
        "id": str(node.id),
        "network_id": network_id,
        "repository_id": repo_id,
        "is_upstream": node.is_upstream,
        "auto_merge": node.auto_merge,
        "sync_enabled": node.sync_enabled,
    }


@router.get("/sync-networks/{network_id}")
async def get_sync_network(
    network_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a sync network with its nodes."""
    try:
        nid = UUID(network_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid network id")

    result = await db.execute(
        select(SyncNetwork).where(SyncNetwork.id == nid, SyncNetwork.user_id == current_user.id)
    )
    network = result.scalar_one_or_none()
    if not network:
        raise HTTPException(status_code=404, detail="Sync network not found")

    nodes_result = await db.execute(
        select(SyncNetworkNode).where(SyncNetworkNode.network_id == nid)
    )
    nodes = nodes_result.scalars().all()

    events_result = await db.execute(
        select(SyncNetworkEvent)
        .where(SyncNetworkEvent.network_id == nid)
        .order_by(desc(SyncNetworkEvent.created_at))
        .limit(20)
    )
    events = events_result.scalars().all()

    node_details = []
    for node in nodes:
        repo_result = await db.execute(
            select(Repository).where(Repository.id == node.repository_id)
        )
        repo = repo_result.scalar_one_or_none()
        node_details.append({
            "id": str(node.id),
            "repository_id": str(node.repository_id),
            "repo_name": repo.full_name if repo else "Unknown",
            "is_upstream": node.is_upstream,
            "sync_enabled": node.sync_enabled,
            "auto_merge": node.auto_merge,
            "sync_order": node.sync_order,
            "last_sync_at": node.last_sync_at.isoformat() if node.last_sync_at else None,
        })

    return {
        "id": str(network.id),
        "name": network.name,
        "description": network.description,
        "status": network.status.value,
        "sync_frequency": network.sync_frequency,
        "conflict_strategy": network.conflict_strategy,
        "auto_discover": network.auto_discover,
        "notify_on_sync": network.notify_on_sync,
        "notify_on_conflict": network.notify_on_conflict,
        "last_sync_at": network.last_sync_at.isoformat() if network.last_sync_at else None,
        "nodes": node_details,
        "recent_events": [
            {
                "event_type": e.event_type,
                "details": e.details,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


@router.post("/sync-networks/{network_id}/sync")
async def trigger_network_sync(
    network_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger sync across the entire network."""
    try:
        nid = UUID(network_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid network id")

    result = await db.execute(
        select(SyncNetwork).where(SyncNetwork.id == nid, SyncNetwork.user_id == current_user.id)
    )
    network = result.scalar_one_or_none()
    if not network:
        raise HTTPException(status_code=404, detail="Sync network not found")

    nodes_result = await db.execute(
        select(SyncNetworkNode).where(
            and_(SyncNetworkNode.network_id == nid, SyncNetworkNode.sync_enabled == True)
        )
    )
    nodes = nodes_result.scalars().all()

    if not nodes:
        raise HTTPException(status_code=400, detail="No enabled nodes in network")

    # Find upstream node
    upstream_node = next((n for n in nodes if n.is_upstream), nodes[0])
    fork_nodes = [n for n in nodes if not n.is_upstream]

    sync_results = []
    for fork_node in fork_nodes:
        try:
            # Sync each fork with the upstream
            from app.api.v1.auto_merge import assess_merge_risk, execute_merge

            # In a background task, we'd run the full merge pipeline
            sync_results.append({
                "node_id": str(fork_node.id),
                "repository_id": str(fork_node.repository_id),
                "status": "queued",
                "auto_merge": fork_node.auto_merge,
            })
        except Exception as exc:
            sync_results.append({
                "node_id": str(fork_node.id),
                "repository_id": str(fork_node.repository_id),
                "status": "error",
                "error": str(exc)[:200],
            })

    # Log sync event
    event = SyncNetworkEvent(
        network_id=nid,
        event_type="sync_started",
        details={"total_nodes": len(nodes), "forks": len(fork_nodes), "results": sync_results},
    )
    db.add(event)
    network.last_sync_at = datetime.utcnow()
    await db.commit()

    return {
        "network_id": network_id,
        "network_name": network.name,
        "upstream_node_id": str(upstream_node.id) if upstream_node else None,
        "total_forks": len(fork_nodes),
        "sync_results": sync_results,
    }


@router.delete("/sync-networks/{network_id}/nodes/{node_id}")
async def remove_network_node(
    network_id: str,
    node_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a node from a sync network."""
    try:
        nid = UUID(network_id)
        ndid = UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id format")

    node_result = await db.execute(
        select(SyncNetworkNode).where(
            SyncNetworkNode.id == ndid,
            SyncNetworkNode.network_id == nid,
        )
    )
    node = node_result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    await db.delete(node)

    event = SyncNetworkEvent(
        network_id=nid,
        event_type="node_removed",
        target_repo_id=node.repository_id,
    )
    db.add(event)
    await db.commit()

    return {"success": True}
