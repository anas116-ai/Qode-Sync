"""Async SQLAlchemy database setup with proper connection pooling.

Uses the legacy ``declarative_base()`` (still fully supported in SQLAlchemy 2.x)
because the existing models rely on the imperative ``Column`` style.
"""
from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.config import settings


def _to_async_dsn(url: str) -> str:
    """Convert a sync Postgres URL to its asyncpg driver variant."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Engine with sensible pool settings for an async web workload.
engine = create_async_engine(
    _to_async_dsn(settings.DATABASE_URL),
    echo=False,  # set True for SQL debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)

# expire_on_commit=False keeps attributes accessible after commit (common async gotcha).
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Single shared declarative base for all ORM models.
Base = declarative_base()


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a per-request session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables. Use Alembic in production; this is a dev convenience."""
    from app import models  # noqa: F401  (imports register the tables on Base)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Dispose of the engine on shutdown."""
    await engine.dispose()
