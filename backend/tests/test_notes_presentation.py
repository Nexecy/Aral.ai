import io

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import NoteContent

client = TestClient(app)
AUTH = {"Authorization": "Bearer demo-token"}


def test_note_content_accepts_highlight_presentation():
    content = NoteContent(
        title="Guide",
        summary="Photosynthesis converts light energy.",
        presentation={
            "highlight_mode": "manual",
            "marks": [
                {
                    "id": "m1",
                    "path": "summary",
                    "start": 0,
                    "end": 14,
                    "text": "Photosynthesis",
                    "kind": "highlight",
                    "color": "yellow",
                    "source": "manual",
                },
                {
                    "id": "m2",
                    "path": "summary",
                    "start": 24,
                    "end": 32,
                    "text": "converts",
                    "kind": "bold",
                },
            ],
        },
    )
    assert content.presentation is not None
    assert content.presentation.highlight_mode == "manual"
    assert len(content.presentation.marks) == 2
    assert content.presentation.marks[0].text == "Photosynthesis"
    assert content.presentation.marks[1].kind == "bold"


def _session_id() -> str:
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("notes_presentation.txt", io.BytesIO(b"Light reactions produce ATP."), "text/plain")},
        headers=AUTH,
    )
    assert upload.status_code in (200, 202), upload.text
    created = client.post(
        "/api/sessions",
        json={"title": "Notes presentation", "document_id": upload.json()["id"]},
        headers=AUTH,
    )
    assert created.status_code == 200, created.text
    return created.json()["id"]


def test_notes_update_preserves_presentation():
    session_id = _session_id()
    payload = {
        "content": {
            "title": "Updated Study Guide",
            "summary": "Photosynthesis converts light energy.",
            "sections": [
                {
                    "heading": "Section 1: Foundations",
                    "subpoints": ["Point A", "Point B"],
                    "key_terms": [{"term": "Term X", "definition": "Def X"}],
                }
            ],
            "presentation": {
                "highlight_mode": "auto",
                "marks": [
                    {
                        "id": "m1",
                        "path": "summary",
                        "start": 0,
                        "end": 14,
                        "text": "Photosynthesis",
                        "kind": "highlight",
                        "color": "green",
                        "source": "manual",
                    }
                ],
            },
        },
        "scope": "highlights",
    }
    response = client.put(f"/api/sessions/{session_id}/notes", json=payload, headers=AUTH)
    assert response.status_code == 200, response.text
    presentation = response.json()["content"]["presentation"]
    assert presentation["highlight_mode"] == "auto"
    assert presentation["marks"][0]["text"] == "Photosynthesis"
    assert presentation["marks"][0]["color"] == "green"
