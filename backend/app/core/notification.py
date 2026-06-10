"""Legacy shim for the multi-channel notification system."""
from app.core.notifications_providers import (
    send_notification,
    get_provider,
    NotificationProvider,
    EmailProvider,
    SlackProvider,
    DiscordProvider,
    TelegramProvider,
    TeamsProvider,
    WebhookProvider,
    WebPushProvider,
)

__all__ = [
    "send_notification",
    "get_provider",
    "NotificationProvider",
    "EmailProvider",
    "SlackProvider",
    "DiscordProvider",
    "TelegramProvider",
    "TeamsProvider",
    "WebhookProvider",
    "WebPushProvider",
]
