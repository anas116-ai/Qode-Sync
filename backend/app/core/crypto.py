"""Token encryption helpers using Fernet symmetric encryption."""
from __future__ import annotations
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings
import base64
import hashlib


def _get_fernet_key() -> bytes:
    """Derive a 32-byte Fernet key from SECRET_KEY (deterministic)."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_get_fernet_key())


def encrypt_token(plain: str) -> str:
    """Encrypt a GitHub PAT before storage."""
    if not plain:
        return plain
    return _fernet.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_token(cipher: Optional[str]) -> Optional[str]:
    """Decrypt a stored GitHub PAT. Pass-through on legacy plaintext."""
    if not cipher:
        return None
    try:
        return _fernet.decrypt(cipher.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Token may have been stored plaintext (legacy). Return as-is.
        return cipher
