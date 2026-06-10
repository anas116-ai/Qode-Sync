"""Celery application + beat schedule.

The schedule below is intentionally explicit (every entry references an
``@celery.task``-decorated function) so the names stay in sync.
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery(
    "forktracker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.sync_worker",
        "app.workers.notification_worker",
        "app.workers.merge_worker",
        "app.workers.testing_worker",
        "app.workers.deploy_worker",
    ],
)

celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=4,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60 * 30,  # 30 minutes hard cap
    task_soft_time_limit=60 * 25,
)

# Schedules: hourly, daily, and interval-based tasks
celery.conf.beat_schedule = {
    # --- Existing tasks ---
    "sync-all-users-forks-hourly": {
        "task": "app.workers.sync_worker.sync_all_users_forks_task",
        "schedule": crontab(minute=0),  # top of every hour
    },
    "send-due-digests-every-15m": {
        "task": "app.workers.notification_worker.send_due_digests_sweep",
        "schedule": crontab(minute="*/15"),
    },
    "cleanup-old-notifications-daily": {
        "task": "app.workers.notification_worker.cleanup_old_notifications",
        "schedule": crontab(hour=3, minute=0),  # 03:00 UTC
    },
    # --- Auto-merge tasks ---
    "auto-merge-approved-jobs-hourly": {
        "task": "app.workers.merge_worker.execute_auto_merge_task",
        "schedule": crontab(minute=30),  # every hour at :30
    },
    # --- Daily auto-merge for watched forks ---
    "auto-merge-watched-forks-daily": {
        "task": "app.workers.merge_worker.auto_merge_watched_forks_daily",
        "schedule": crontab(hour=6, minute=0),  # 06:00 UTC daily
    },
    # --- Daily sync network sync ---
    "sync-all-active-networks-daily": {
        "task": "app.workers.sync_worker.sync_all_users_forks_task",
        "schedule": crontab(hour=7, minute=0),  # 07:00 UTC daily (after auto-merge)
    },
}


def get_celery_app() -> Celery:
    return celery
