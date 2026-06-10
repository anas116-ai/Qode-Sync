"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1 import api_router
from app.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.database import close_db, init_db

logger = logging.getLogger("forktracker")
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown hooks: create tables (dev only) and dispose of engine."""
    logger.info("Fork Tracker API starting (env=%s)", settings.ENVIRONMENT)
    if settings.ENVIRONMENT == "development":
        try:
            await init_db()
        except Exception as exc:  # noqa: BLE001
            logger.warning("init_db skipped: %s", exc)
    try:
        yield
    finally:
        await close_db()
        logger.info("Fork Tracker API shut down cleanly")


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description="Monitor GitHub fork updates with AI-powered insights.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --- Security middleware ---------------------------------------------------
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])  # tighten in prod
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
)

# --- Routers ---------------------------------------------------------------
app.include_router(api_router, prefix="/api/v1")


# --- Health & root ---------------------------------------------------------
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.ENVIRONMENT,
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
