"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from typing import List

try:
    # pydantic-settings is the canonical place for env-driven config.
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # pragma: no cover - fallback for minimal envs
    from pydantic import BaseSettings  # type: ignore

    SettingsConfigDict = None  # type: ignore


def _split_csv(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    # --- Core ----------------------------------------------------------------
    APP_NAME: str = "Fork Tracker"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

    # --- Database / Cache / Queue ------------------------------------------
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/forktracker",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "") or os.getenv(
        "REDIS_URL", "redis://localhost:6379/0"
    )
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND", ""
    ) or os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # --- Security ------------------------------------------------------------
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "change-me-in-production-this-is-not-secure"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    )

    # --- GitHub integration -------------------------------------------------
    GITHUB_APP_ID: str = os.getenv("GITHUB_APP_ID", "")
    GITHUB_PRIVATE_KEY: str = os.getenv("GITHUB_PRIVATE_KEY", "")
    GITHUB_WEBHOOK_SECRET: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")

    # --- AI ------------------------------------------------------------------
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

    # --- Notifications -------------------------------------------------------
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@forktracker.app")
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")
    DISCORD_WEBHOOK_URL: str = os.getenv("DISCORD_WEBHOOK_URL", "")

    # --- Storage -------------------------------------------------------------
    S3_BUCKET: str = os.getenv("S3_BUCKET", "")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "")

    # --- Application tuning -------------------------------------------------
    MAX_FORKS_PER_USER: int = int(os.getenv("MAX_FORKS_PER_USER", "500"))
    SYNC_INTERVAL_HOURS: int = int(os.getenv("SYNC_INTERVAL_HOURS", "6"))
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    # --- Backwards-compat aliases -------------------------------------------
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        return _split_csv(self.CORS_ORIGINS)

    @property
    def SUPABASE_URL(self) -> str:
        return os.getenv("SUPABASE_URL", "")

    @property
    def SUPABASE_KEY(self) -> str:
        return os.getenv("SUPABASE_KEY", "")

    if SettingsConfigDict is not None:  # pragma: no cover - pydantic-settings only
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=True,
            extra="ignore",
        )


settings = Settings()
