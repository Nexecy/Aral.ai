"""Anonymous-fallback gating for get_current_user.

The API resolves requests without a token (or with the `demo-token` sentinel)
to a shared local identity for local development and tests. That convenience
must be disabled in production or whenever real Supabase auth is configured,
so unauthenticated callers cannot act as the shared account.
"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

DEMO_AUTH = {"Authorization": "Bearer demo-token"}


def test_fallback_enabled_by_default_in_dev():
    """Default dev config (no production flag, no Supabase) keeps the fallback."""
    assert settings.allow_anonymous_fallback is True

    no_token = client.get("/api/auth/me")
    assert no_token.status_code == 200, no_token.text

    demo = client.get("/api/auth/me", headers=DEMO_AUTH)
    assert demo.status_code == 200, demo.text


def test_production_requires_token(monkeypatch):
    """ENVIRONMENT=production disables the anonymous + demo fallback."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.allow_anonymous_fallback is False

    no_token = client.get("/api/auth/me")
    assert no_token.status_code == 401

    demo = client.get("/api/auth/me", headers=DEMO_AUTH)
    assert demo.status_code == 401


def test_production_blocks_unauthenticated_state_change(monkeypatch):
    """A state-changing endpoint cannot be called without a token in prod."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    resp = client.post("/api/billing/upgrade", json={"plan": "student"})
    assert resp.status_code == 401


def test_configured_supabase_requires_token(monkeypatch):
    """Even outside production, configuring real auth disables the fallback."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "service-role-key")
    assert settings.has_supabase_credentials is True
    assert settings.allow_anonymous_fallback is False

    no_token = client.get("/api/auth/me")
    assert no_token.status_code == 401


def test_malformed_header_still_rejected():
    """A non-Bearer header is rejected regardless of fallback mode."""
    resp = client.get("/api/auth/me", headers={"Authorization": "Basic abc123"})
    assert resp.status_code == 401
