"""Simple in-memory rate limiting middleware (per IP)."""
from __future__ import annotations
import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# {ip: deque[timestamp]}
_hits: dict = defaultdict(deque)

# Paths exempt from rate limiting
_EXEMPT_PATHS = frozenset({"/", "/health", "/docs", "/openapi.json", "/redoc"})


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket-ish rate limiter.

    Default: 120 requests per minute per IP. Health/root are exempt.
    Configure via env or constructor arg in main.py.
    """

    def __init__(self, app, requests_per_minute: int = 120) -> None:
        super().__init__(app)
        self.rpm = requests_per_minute
        self.window = 60.0

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in _EXEMPT_PATHS:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window
        bucket = _hits[client_ip]
        # Drop old hits
        while bucket and bucket[0] < window_start:
            bucket.popleft()

        if len(bucket) >= self.rpm:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again in a minute."},
                headers={"Retry-After": "60"},
            )
        bucket.append(now)
        return await call_next(request)
