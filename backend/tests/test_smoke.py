"""Basic smoke tests for the FastAPI app — run with `pytest`."""
import pytest
from fastapi.testclient import TestClient


def test_health():
    """The /health endpoint should always return 200."""
    from app.main import app
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


def test_root():
    from app.main import app
    with TestClient(app) as client:
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        # The endpoint returns settings.APP_NAME which defaults to "Fork Tracker"
        # in production the value comes from the APP_NAME env var.
        assert "Fork Tracker" in body["name"]
        assert body["version"]
        assert body["docs"] == "/docs"
        assert body["openapi"] == "/openapi.json"


def test_crypto_roundtrip():
    from app.core.crypto import encrypt_token, decrypt_token
    secret = "ghp_testtoken1234567890"
    enc = encrypt_token(secret)
    assert enc != secret
    dec = decrypt_token(enc)
    assert dec == secret


def test_crypto_legacy_plaintext_passthrough():
    """If a token was stored plaintext, decrypt should return as-is."""
    from app.core.crypto import decrypt_token
    plain = "ghp_plaintext_legacy"
    assert decrypt_token(plain) == plain
