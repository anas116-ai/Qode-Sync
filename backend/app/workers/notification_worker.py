"""Celery tasks for delivering notifications to users."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select

from app.core.crypto import decrypt_token
from app.core.notification import send_notification
from app.database import AsyncSessionLocal
from app.models.notification import (
    Notification,
    NotificationChannel,
    NotificationRule,
    NotificationStatus,
)
from app.models.update import Update
from app.models.user import UserProfile
from app.workers.task_schedule import celery

logger = logging.getLogger("forktracker.notifications")


# ---------------------------------------------------------------------------
# Async coroutines
# ---------------------------------------------------------------------------
async def send_notification_for_update(
    user_id: str,
    update_id: str,
    channel: str = "email",
) -> Dict[str, Any]:
    """Create a Notification row and dispatch via the requested channel.

    Returns a dict with the notification id and delivery status.
    """
    async with AsyncSessionLocal() as db:
        update_result = await db.execute(
            select(Update).where(Update.id == update_id)
        )
        update = update_result.scalar_one_or_none()
        if update is None:
            return {"ok": False, "reason": "update_not_found"}

        # Look up the user's notification rule (if any) and use the first
        # matching enabled rule; fall back to the explicit channel argument.
        rule_result = await db.execute(
            select(NotificationRule)
            .where(NotificationRule.user_id == user_id)
            .where(NotificationRule.enabled.is_(True))
        )
        rules: List[NotificationRule] = list(rule_result.scalars().all())

        target_channel = channel
        target_address: Optional[str] = None

        if rules:
            rule = rules[0]
            target_channel = rule.channel
            cfg = rule.config or {}
            target_address = (
                cfg.get("address")
                or cfg.get("webhook_url")
                or cfg.get("chat_id")
            )

        # Pull user contact info when the rule didn't specify an address.
        if not target_address:
            profile_result = await db.execute(
                select(UserProfile).where(UserProfile.id == user_id)
            )
            profile = profile_result.scalar_one_or_none()
            if profile is None:
                return {"ok": False, "reason": "user_not_found"}
            if target_channel == "email":
                target_address = profile.email

        if not target_address:
            return {"ok": False, "reason": "no_target_address"}

        subject = update.title or "New update detected"
        body = (
            update.ai_summary
            or update.ai_summary_detailed
            or update.description
            or "New update detected"
        )

        notification = Notification(
            user_id=user_id,
            update_id=update.id,
            repository_id=update.repository_id,
            channel=target_channel,
            title=subject,
            body=body,
            status=NotificationStatus.pending,
        )
        db.add(notification)
        try:
            await db.flush()
        except Exception:  # noqa: BLE001
            await db.rollback()
            return {"ok": False, "reason": "db_error"}

        delivered = await send_notification(
            channel=target_channel,
            to=target_address,
            subject=subject,
            body=body,
            metadata={"update_id": str(update.id)},
        )

        notification.status = (
            NotificationStatus.sent if delivered else NotificationStatus.failed
        )
        from datetime import datetime

        notification.sent_at = datetime.utcnow() if delivered else None
        update.notified = True
        await db.commit()

        return {
            "ok": delivered,
            "notification_id": str(notification.id),
            "channel": target_channel,
        }


async def send_due_digest(user_id: str) -> Dict[str, int]:
    """Send a digest of un-notified updates according to the user's rules."""
    async with AsyncSessionLocal() as db:
        unnotified = (
            await db.execute(
                select(Update)
                .where(Update.user_id == user_id)
                .where(Update.notified.is_(False))
            )
        ).scalars().all()

        sent = 0
        for upd in unnotified:
            res = await send_notification_for_update(
                user_id=user_id,
                update_id=str(upd.id),
                channel="email",
            )
            if res.get("ok"):
                sent += 1
        return {"queued": len(unnotified), "sent": sent}


# ---------------------------------------------------------------------------
# Celery task wrappers (sync entry points)
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.notification_worker.send_notification_task")
def send_notification_task(user_id: str, update_id: str, channel: str = "email") -> Dict[str, Any]:
    return asyncio.run(
        send_notification_for_update(user_id, update_id, channel)
    )


@celery.task(name="app.workers.notification_worker.send_due_digest_task")
def send_due_digest_task(user_id: str) -> Dict[str, int]:
    return asyncio.run(send_digest(user_id))


async def send_digest(user_id: str) -> Dict[str, int]:
    return await send_due_digest(user_id)


# ---------------------------------------------------------------------------
# Direct-send helpers (kept for backwards compatibility with old imports).
# ---------------------------------------------------------------------------
async def send_slack_notification(webhook_url: str, message: str) -> bool:
    if not webhook_url:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json={"text": message})
        return 200 <= r.status_code < 300
    except Exception:  # noqa: BLE001
        return False


async def send_discord_notification(webhook_url: str, message: str) -> bool:
    if not webhook_url:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json={"content": message})
        return 200 <= r.status_code < 300
    except Exception:  # noqa: BLE001
        return False


async def send_telegram_notification(
    bot_token: str, chat_id: str, message: str
) -> bool:
    if not bot_token or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": message},
            )
        return r.status_code == 200
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------------------
# Scheduled maintenance tasks
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.notification_worker.send_due_digests_sweep")
def send_due_digests_sweep() -> Dict[str, int]:
    """Iterate every user with a notification rule and dispatch a digest."""
    async def _run() -> Dict[str, int]:
        async with AsyncSessionLocal() as db:
            user_ids = (
                await db.execute(
                    select(UserProfile.id)
                )
            ).scalars().all()

        total = {"users": len(user_ids), "sent": 0}
        for uid in user_ids:
            try:
                res = await send_due_digest(str(uid))
                total["sent"] += res.get("sent", 0)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Digest failed for %s: %s", uid, exc)
        return total

    return asyncio.run(_run())


@celery.task(name="app.workers.notification_worker.cleanup_old_notifications")
def cleanup_old_notifications(days: int = 30) -> Dict[str, int]:
    """Delete read notifications older than ``days`` days."""
    from datetime import datetime, timedelta

    async def _run() -> Dict[str, int]:
        async with AsyncSessionLocal() as db:
            cutoff = datetime.utcnow() - timedelta(days=days)
            result = await db.execute(
                select(Notification)
                .where(Notification.is_read.is_(True))
                .where(Notification.created_at < cutoff)
            )
            old = list(result.scalars().all())
            for n in old:
                await db.delete(n)
            await db.commit()
            return {"deleted": len(old)}

    return asyncio.run(_run())
