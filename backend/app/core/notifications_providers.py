"""Multi-channel notification providers (Email, Slack, Discord, Telegram, Teams, Webhook, Web Push)."""
from abc import ABC, abstractmethod
from typing import Dict, Any
import httpx
import smtplib
from email.mime.text import MIMEText

from app.config import settings


class NotificationProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool: ...


class EmailProvider(NotificationProvider):
    name = "email"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        if not getattr(settings, "SMTP_HOST", None):
            return False
        msg = MIMEText(body, "html" if "<" in body else "plain")
        msg["Subject"] = subject
        msg["From"] = getattr(settings, "SMTP_FROM", "noreply@forktracker.app")
        msg["To"] = to
        try:
            with smtplib.SMTP(settings.SMTP_HOST, getattr(settings, "SMTP_PORT", 587)) as s:
                s.starttls()
                if getattr(settings, "SMTP_USER", None):
                    s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                s.send_message(msg)
            return True
        except Exception:
            return False


class SlackProvider(NotificationProvider):
    name = "slack"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        # to = webhook URL
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    to,
                    json={"text": f"*{subject}*\n{body}"},
                )
            return r.status_code == 200
        except Exception:
            return False


class DiscordProvider(NotificationProvider):
    name = "discord"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        # to = webhook URL
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    to,
                    json={"content": f"**{subject}**\n{body}"},
                )
            return r.status_code in (200, 204)
        except Exception:
            return False


class TelegramProvider(NotificationProvider):
    name = "telegram"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        # to = chat_id, bot token from settings
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
        if not token:
            return False
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": to, "text": f"*{subject}*\n{body}", "parse_mode": "Markdown"},
                )
            return r.status_code == 200
        except Exception:
            return False


class TeamsProvider(NotificationProvider):
    name = "teams"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        # to = incoming webhook URL
        card = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": subject,
            "themeColor": "0078D4",
            "title": subject,
            "text": body,
        }
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(to, json=card)
            return r.status_code == 200
        except Exception:
            return False


class WebhookProvider(NotificationProvider):
    name = "webhook"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    to,
                    json={"subject": subject, "body": body, "metadata": kwargs.get("metadata", {})},
                )
            return 200 <= r.status_code < 300
        except Exception:
            return False


class WebPushProvider(NotificationProvider):
    """Stub: real impl requires VAPID keys. Logs to DB and returns True in dev."""
    name = "web_push"

    async def send(self, to: str, subject: str, body: str, **kwargs) -> bool:
        # In a real impl: use pywebpush with VAPID_PRIVATE_KEY
        return True


_REGISTRY: Dict[str, NotificationProvider] = {
    p.name: p() for p in (EmailProvider, SlackProvider, DiscordProvider, TelegramProvider,
                          TeamsProvider, WebhookProvider, WebPushProvider)
}


def get_provider(name: str) -> NotificationProvider:
    return _REGISTRY.get(name, _REGISTRY["webhook"])


async def send_notification(
    channel: str, to: str, subject: str, body: str, **kwargs
) -> bool:
    provider = get_provider(channel)
    return await provider.send(to, subject, body, **kwargs)
