"""Audit log endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import UserProfile
from app.deps import get_current_user

router = APIRouter()


@router.get("/")
async def list_audit_logs(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str = Query(None),
):
    offset = (page - 1) * page_size
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    count_query = select(func.count(AuditLog.id))
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    query = query.offset(offset).limit(page_size)
    logs = (await db.execute(query)).scalars().all()
    total = (await db.execute(count_query)).scalar() or 0
    return {
        "data": [
            {
                "id": str(l.id),
                "action": l.action.value if hasattr(l.action, "value") else str(l.action),
                "resource_type": l.resource_type,
                "resource_id": str(l.resource_id) if l.resource_id else None,
                "details": l.details or {},
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
