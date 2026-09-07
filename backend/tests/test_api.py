import io
import os
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

AUTH = {"Authorization": "Bearer demo-token"}

SAMPLE_TEXT = (
    "Memory consolidation transfers encoding from the hippocampus to neocortical regions.\n"
    "Long-term potentiation is the persistent strengthening of synapses.\n"
    "Active recall outperforms passive review because retrieval reconstructs the trace.\n"
)


@pytest.fixture(scope="module")
def session_id():
    """Upload a document and open a study session for it. No seed data exists."""
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("memory_systems.txt", io.BytesIO(SAMPLE_TEXT.encode()), "text/plain")},
        headers=AUTH,
    )
    assert upload.status_code in (200, 202), upload.text
    document_id = upload.json()["id"]

    created = client.post(
        "/api/sessions",
        json={"title": "Cognitive Neuroscience: Memory Systems", "document_id": document_id},
        headers=AUTH,
    )
    assert created.status_code == 200, created.text
    return created.json()["id"]


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "Aral.ai API"
    assert data["status"] == "operational"


def test_auth_me():
    response = client.get("/api/auth/me", headers=AUTH)
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert data["id"] is not None
    assert "display_name" in data
    assert "avatar_url" in data
    assert "bio" in data
    assert "gender" in data
    assert "theme" in data


def test_profile_update_and_password_change():
    email = f"profile-{os.urandom(4).hex()}@aral.ai"
    password = "studyhard1"
    created = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert created.status_code == 200, created.text
    token = created.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    updated = client.patch(
        "/api/auth/profile",
        json={
            "display_name": "Ada",
            "bio": "Neuroscience student",
            "gender": "prefer_not_to_say",
        },
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    data = updated.json()
    assert data["display_name"] == "Ada"
    assert data["bio"] == "Neuroscience student"
    assert data["gender"] == "prefer_not_to_say"

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["display_name"] == "Ada"

    empty = client.patch("/api/auth/profile", json={"display_name": "  "}, headers=headers)
    assert empty.status_code == 400

    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": password, "new_password": "studyhard2"},
        headers=headers,
    )
    assert changed.status_code == 200, changed.text

    wrong = client.post(
        "/api/auth/change-password",
        json={"current_password": password, "new_password": "studyhard3"},
        headers=headers,
    )
    assert wrong.status_code == 401


def test_signup_and_login_issues_a_scoped_token():
    email = f"tester-{os.urandom(4).hex()}@aral.ai"
    password = "studyhard1"

    created = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert created.status_code == 200, created.text
    token = created.json()["access_token"]
    assert token
    assert created.json()["user"]["email"] == email

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["id"] == created.json()["user"]["id"]

    again = client.post("/api/auth/login", json={"email": email, "password": password})
    assert again.status_code == 200
    assert again.json()["access_token"]
    login_user = again.json()["user"]
    assert login_user["email"] == email
    assert "display_name" in login_user
    assert "has_supabase" in login_user
    assert "has_gemini" in login_user
    assert "gemini_model" in login_user

    clash = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert clash.status_code == 409

    wrong = client.post("/api/auth/login", json={"email": email, "password": "wrongpass"})
    assert wrong.status_code == 401


def test_token_refresh():
    email = f"refresh-{os.urandom(4).hex()}@aral.ai"
    password = "studyhard1"

    created = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert created.status_code == 200
    refresh_token = created.json().get("refresh_token")
    assert refresh_token is not None

    # Call /api/auth/refresh with valid refresh token
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200, refreshed.text
    new_data = refreshed.json()
    assert new_data["access_token"] is not None
    assert new_data["refresh_token"] is not None
    assert new_data["user"]["email"] == email

    # Test using the refreshed access token
    headers = {"Authorization": f"Bearer {new_data['access_token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email

    # Test bad refresh token
    bad = client.post("/api/auth/refresh", json={"refresh_token": "invalid-token-string"})
    assert bad.status_code == 401



def test_cors_preflight_max_age_caching():
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
    }
    response = client.options("/api/auth/login", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-max-age") == "86400"


def test_unverified_email_cannot_use_ai_tools():
    import jwt
    from app.core.config import settings

    secret = settings.SUPABASE_JWT_SECRET or "aral-local-dev-secret"
    token = jwt.encode(
        {
            "sub": "22222222-2222-2222-2222-222222222222",
            "email": "pending@aral.ai",
            "aud": "authenticated",
            "email_verified": False,
        },
        secret,
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token}"}
    blocked = client.post("/api/sessions/any/notes/generate", headers=headers)
    assert blocked.status_code == 403


def test_db_service_has_no_seed_records():
    """A freshly constructed store must be empty — no mock sessions or demo documents."""
    from app.services.db_service import DBService

    fresh = DBService()
    assert fresh.sessions == {}
    assert fresh.documents == {}
    assert fresh.notes == {}
    assert fresh.flashcards == {}
    assert fresh.chat_messages == {}


def test_created_session_starts_active(session_id):
    response = client.get(f"/api/sessions/{session_id}", headers=AUTH)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["ended_at"] is None
    assert data["total_focus_seconds"] == 0
    assert data["cards_reviewed"] == 0


def test_list_sessions(session_id):
    response = client.get("/api/sessions", headers=AUTH)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(s["id"] == session_id for s in data)


def test_get_session_snapshot(session_id):
    response = client.get(f"/api/sessions/{session_id}/snapshot", headers=AUTH)
    assert response.status_code == 200
    snapshot = response.json()
    assert "session" in snapshot
    assert "notes" in snapshot
    assert "flashcards" in snapshot


def test_notes_update(session_id):
    update_payload = {
        "content": {
            "title": "Updated Study Guide",
            "summary": "Updated summary for testing.",
            "sections": [
                {
                    "heading": "Section 1: Foundations",
                    "subpoints": ["Point A", "Point B"],
                    "key_terms": [{"term": "Term X", "definition": "Def X"}],
                }
            ],
        },
        "scope": "custom review",
    }
    response = client.put(f"/api/sessions/{session_id}/notes", json=update_payload, headers=AUTH)
    assert response.status_code == 200
    saved = response.json()
    assert saved["content"]["title"] == "Updated Study Guide"


def test_update_session_title(session_id):
    custom_label = "Civil Law - Midterm Review (Chapter 1-4)"
    response = client.patch(
        f"/api/sessions/{session_id}",
        json={"title": custom_label},
        headers=AUTH,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == custom_label

    fetched = client.get(f"/api/sessions/{session_id}", headers=AUTH)
    assert fetched.status_code == 200
    assert fetched.json()["title"] == custom_label


def test_flashcard_generation(session_id):
    response = client.post(f"/api/sessions/{session_id}/flashcards/generate?count=5", headers=AUTH)
    assert response.status_code == 200
    cards = response.json()
    assert isinstance(cards, list)
    assert len(cards) >= 1
    assert "front" in cards[0]
    assert "back" in cards[0]


def test_quiz_generation_and_scoring(session_id):
    gen_res = client.post(
        f"/api/sessions/{session_id}/quizzes/generate",
        json={"quiz_type": "multiple_choice", "question_count": 3},
        headers=AUTH,
    )
    assert gen_res.status_code == 200
    questions = gen_res.json()["questions"]
    assert len(questions) >= 1

    submission = {"answers": {questions[0]["id"]: questions[0]["correct_answer"]}}
    submit_res = client.post(
        f"/api/sessions/{session_id}/quizzes/submit?quiz_type=multiple_choice",
        json={"questions": questions, "submission": submission},
        headers=AUTH,
    )
    assert submit_res.status_code == 200
    result = submit_res.json()
    assert "score" in result
    assert "results" in result


def test_pomodoro_logging():
    log_payload = {"duration_minutes": 25, "completed": True}
    res = client.post("/api/pomodoro/log", json=log_payload, headers=AUTH)
    assert res.status_code == 200
    data = res.json()
    assert data["duration_minutes"] == 25
    assert data["completed"] is True

    stats_res = client.get("/api/pomodoro/stats", headers=AUTH)
    assert stats_res.status_code == 200
    assert stats_res.json()["total_cycles_completed"] >= 1


def test_end_session_syncs_status_and_metrics(session_id):
    res = client.post(
        f"/api/sessions/{session_id}/end",
        json={"status": "completed", "total_focus_seconds": 1500, "cards_reviewed": 12},
        headers=AUTH,
    )
    assert res.status_code == 200
    ended = res.json()
    assert ended["status"] == "completed"
    assert ended["ended_at"] is not None
    assert ended["total_focus_seconds"] == 1500
    assert ended["cards_reviewed"] == 12


def test_reopening_ended_session_reactivates_it(session_id):
    snapshot = client.get(f"/api/sessions/{session_id}/snapshot", headers=AUTH)
    assert snapshot.status_code == 200
    session = snapshot.json()["session"]
    assert session["status"] == "active"
    assert session["ended_at"] is None
    # Metrics accumulated from the previous run are preserved across resume.
    assert session["total_focus_seconds"] == 1500


def test_end_session_unknown_id_returns_404():
    res = client.post(
        "/api/sessions/00000000-0000-0000-0000-0000000000ff/end",
        json={"status": "inactive"},
        headers=AUTH,
    )
    assert res.status_code == 404


# ==============================================================================
# Exams & Dashboard
# ==============================================================================
def _future_date(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


@pytest.fixture
def exam():
    created = client.post(
        "/api/exams",
        json={"title": "Networking Finals", "exam_date": _future_date(33), "color": "teal"},
        headers=AUTH,
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    yield payload
    client.delete(f"/api/exams/{payload['id']}", headers=AUTH)


def test_exam_crud_round_trip(exam):
    assert exam["title"] == "Networking Finals"
    assert exam["days_remaining"] == 33
    assert exam["color"] == "teal"

    listed = client.get("/api/exams", headers=AUTH)
    assert listed.status_code == 200
    assert any(e["id"] == exam["id"] for e in listed.json())

    patched = client.patch(
        f"/api/exams/{exam['id']}", json={"title": "Networking Retake"}, headers=AUTH
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Networking Retake"

    removed = client.delete(f"/api/exams/{exam['id']}", headers=AUTH)
    assert removed.status_code == 200
    assert client.get(f"/api/exams/{exam['id']}", headers=AUTH).status_code == 404


def test_past_exams_are_retained_with_negative_countdown():
    created = client.post(
        "/api/exams",
        json={"title": "Last Term Midterm", "exam_date": _future_date(-10)},
        headers=AUTH,
    )
    assert created.status_code == 201
    exam_id = created.json()["id"]
    try:
        assert created.json()["days_remaining"] == -10
        # Kept as a record rather than deleted.
        listed = client.get("/api/exams", headers=AUTH).json()
        assert any(e["id"] == exam_id for e in listed)
    finally:
        client.delete(f"/api/exams/{exam_id}", headers=AUTH)


def test_nearest_upcoming_exam_drives_dashboard_countdown():
    far = client.post(
        "/api/exams", json={"title": "Far Exam", "exam_date": _future_date(40)}, headers=AUTH
    ).json()
    near = client.post(
        "/api/exams", json={"title": "Near Exam", "exam_date": _future_date(5)}, headers=AUTH
    ).json()
    past = client.post(
        "/api/exams", json={"title": "Old Exam", "exam_date": _future_date(-3)}, headers=AUTH
    ).json()

    try:
        summary = client.get("/api/dashboard/summary", headers=AUTH)
        assert summary.status_code == 200
        data = summary.json()
        # The soonest future exam wins; past exams never surface as the countdown.
        assert data["nearest_exam"]["id"] == near["id"]
        assert data["days_until_nearest_exam"] == 5
    finally:
        for created in (far, near, past):
            client.delete(f"/api/exams/{created['id']}", headers=AUTH)


def test_exam_rejects_unknown_linked_document():
    res = client.post(
        "/api/exams",
        json={
            "title": "Orphan",
            "exam_date": _future_date(7),
            "document_id": "00000000-0000-0000-0000-0000000000ff",
        },
        headers=AUTH,
    )
    assert res.status_code == 404


def test_dashboard_summary_reports_real_counters(session_id):
    res = client.get("/api/dashboard/summary", headers=AUTH)
    assert res.status_code == 200
    data = res.json()

    assert data["has_data"] is True
    assert data["total_sessions"] >= 1
    assert data["total_documents"] >= 1
    # Backed by the pomodoro log written earlier in this module.
    assert data["total_focus_minutes"] >= 25
    assert data["study_streak_days"] >= 1
    assert data["latest_session_id"] is not None


def test_documents_are_scoped_to_the_authenticated_user(session_id):
    """A different bearer identity must not see this user's documents."""
    other = {"Authorization": "Bearer " + _foreign_token()}

    mine = client.get("/api/documents", headers=AUTH).json()
    assert len(mine) >= 1
    document_id = mine[0]["id"]

    assert client.get(f"/api/documents/{document_id}", headers=other).status_code == 404
    assert client.get(f"/api/documents/{document_id}/file", headers=other).status_code == 404
    assert client.get(f"/api/sessions/{session_id}", headers=other).status_code == 404


def _foreign_token() -> str:
    """A JWT for a different subject, signed with the configured secret when present."""
    import jwt
    from app.core.auth import LOCAL_JWT_SECRET
    from app.core.config import settings

    secret = settings.SUPABASE_JWT_SECRET or LOCAL_JWT_SECRET
    return jwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "other@aral.ai",
            "aud": "authenticated",
        },
        secret,
        algorithm="HS256",
    )


def test_get_session_snapshot_not_found(capsys):
    """
    Verify that requesting a non-existent session ID returns a clean 404 response
    with {"detail": "Session snapshot not found"} without noisy backend error logs.
    """
    response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/snapshot", headers=AUTH)
    assert response.status_code == 404
    assert response.json()["detail"] == "Session snapshot not found"

    # Confirm no noisy error stack trace was logged to stdout/stderr
    captured = capsys.readouterr()
    assert "[DBService] Supabase get session error" not in captured.out
    assert "[DBService] Supabase get session error" not in captured.err


@pytest.mark.asyncio
async def test_supabase_pgrst116_handled_cleanly(capsys):
    """
    Verify that when Supabase/PostgREST throws PGRST116 ('The result contains 0 rows'),
    DBService handles it silently without printing unhandled database exception stack traces.
    """
    from unittest.mock import MagicMock
    from app.services.db_service import db_service

    # Create mock that raises PGRST116 exception
    mock_supabase = MagicMock()
    pgrst_error = Exception({'message': 'Cannot coerce the result to a single JSON object', 'code': 'PGRST116', 'hint': None, 'details': 'The result contains 0 rows'})
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = pgrst_error

    orig_supabase = db_service.supabase
    try:
        db_service.supabase = mock_supabase
        res = await db_service.get_session("non-existent-uuid")
        assert res is None

        # Verify no noisy error was printed
        captured = capsys.readouterr()
        assert "[DBService] Supabase get session error" not in captured.out
        assert "[DBService] Supabase get session error" not in captured.err
    finally:
        db_service.supabase = orig_supabase

