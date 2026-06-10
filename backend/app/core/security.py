"""Security helpers: JWT, password hashing, token issuance.

Uses ``PyJWT`` (already in requirements) for token signing/verification
and ``passlib[bcrypt]`` for password hashing.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from jwt import InvalidTokenError
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def _now() -> datetime:
    """Timezone-aware ``datetime.now()`` to silence the deprecation warning."""
    return datetime.now(tz=timezone.utc)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Sign an access token. ``data`` is copied and never mutated."""
    to_encode: Dict[str, Any] = {**data}
    expire = _now() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": _now(), "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode: Dict[str, Any] = {**data}
    expire = _now() + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "iat": _now(), "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Return the JWT payload or ``None`` if the token is invalid/expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except InvalidTokenError:
        return None
