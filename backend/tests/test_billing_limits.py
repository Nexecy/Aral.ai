"""Freemium plan limits, Student upgrade stub, and BYOK."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.db_service import db_service

client = TestClient(app)
AUTH = {"Authorization": "Bearer demo-token"}
LOCAL_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(autouse=True)
def _enforce_quotas(monkeypatch):
    monkeypatch.setenv("ARAL_TEST_ENFORCE_QUOTAS", "1")


@pytest.fixture(autouse=True)
def _reset_billing_state():
    """Isolate plan + usage between tests."""
    db_service.usage_daily.clear()
    db_service.profiles[LOCAL_ID] = {
        "id": LOCAL_ID,
        "display_name": None,
        "avatar_url": None,
        "bio": None,
        "gender": None,
        "theme": None,
        "plan": "free",
        "plan_updated_at": None,
        "has_byok": False,
        "byok_gemini_key": None,
    }
    yield
    db_service.usage_daily.clear()


def _make_session() -> str:
    created = client.post(
        "/api/sessions",
        json={"title": "Billing Limit Session", "document_id": None},
        headers=AUTH,
    )
    assert created.status_code in (200, 201), created.text
    return created.json()["id"]


def test_plans_catalog_lists_php_prices():
    res = client.get("/api/billing/plans")
    assert res.status_code == 200
    data = res.json()
    assert data["currency"] == "PHP"
    ids = {p["id"] for p in data["plans"]}
    assert ids == {"free", "student"}
    student = next(p for p in data["plans"] if p["id"] == "student")
    assert student["price_php"] == settings.STUDENT_PRICE_PHP


def test_usage_endpoint_starts_at_zero_on_free():
    res = client.get("/api/billing/usage", headers=AUTH)
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["used"]["notes"] == 0
    assert data["limits"]["notes"] == settings.FREE_DAILY_NOTES
    assert data["student_price_php"] == settings.STUDENT_PRICE_PHP


def test_free_plan_blocks_notes_after_daily_limit():
    session_id = _make_session()
    limit = settings.FREE_DAILY_NOTES

    for i in range(limit):
        res = client.post(
            f"/api/sessions/{session_id}/notes/generate?force=true",
            headers=AUTH,
        )
        assert res.status_code == 200, f"gen {i}: {res.text}"

    blocked = client.post(
        f"/api/sessions/{session_id}/notes/generate?force=true",
        headers=AUTH,
    )
    assert blocked.status_code == 403
    assert "Daily note generations limit reached" in blocked.json()["detail"]
    assert "Student" in blocked.json()["detail"]


def test_stub_upgrade_to_student_raises_limits():
    session_id = _make_session()
    # Burn free notes quota
    for _ in range(settings.FREE_DAILY_NOTES):
        assert (
            client.post(
                f"/api/sessions/{session_id}/notes/generate?force=true",
                headers=AUTH,
            ).status_code
            == 200
        )

    assert (
        client.post(
            f"/api/sessions/{session_id}/notes/generate?force=true",
            headers=AUTH,
        ).status_code
        == 403
    )

    upgraded = client.post("/api/billing/upgrade", json={"plan": "student"}, headers=AUTH)
    assert upgraded.status_code == 200
    assert upgraded.json()["plan"] == "student"

    # Same UTC day counters remain, but Student ceiling is higher
    ok = client.post(
        f"/api/sessions/{session_id}/notes/generate?force=true",
        headers=AUTH,
    )
    assert ok.status_code == 200, ok.text

    me = client.get("/api/auth/me", headers=AUTH)
    assert me.status_code == 200
    assert me.json()["plan"] == "student"


def test_byok_bypasses_daily_limits():
    session_id = _make_session()
    for _ in range(settings.FREE_DAILY_NOTES):
        assert (
            client.post(
                f"/api/sessions/{session_id}/notes/generate?force=true",
                headers=AUTH,
            ).status_code
            == 200
        )

    assert (
        client.post(
            f"/api/sessions/{session_id}/notes/generate?force=true",
            headers=AUTH,
        ).status_code
        == 403
    )

    saved = client.put(
        "/api/billing/byok",
        json={"api_key": "AIzaSy-test-key-for-byok-bypass"},
        headers=AUTH,
    )
    assert saved.status_code == 200
    assert saved.json()["has_byok"] is True

    ok = client.post(
        f"/api/sessions/{session_id}/notes/generate?force=true",
        headers=AUTH,
    )
    assert ok.status_code == 200, ok.text

    usage = client.get("/api/billing/usage", headers=AUTH).json()
    assert usage["has_byok"] is True
    assert usage["byok_bypasses_limits"] is True


def test_cancel_returns_to_free():
    client.post("/api/billing/upgrade", json={"plan": "student"}, headers=AUTH)
    cancelled = client.post("/api/billing/cancel", headers=AUTH)
    assert cancelled.status_code == 200
    assert cancelled.json()["plan"] == "free"
