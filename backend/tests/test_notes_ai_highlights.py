from app.services.notes_terms import flatten_note_fields, ground_highlights


STORY_NOTES = {
    "title": "Study Notes: Three Little Pigs",
    "summary": "The wolf huffed and puffed until the straw house fell.",
    "sections": [
        {
            "heading": "The Wolf's Attacks",
            "subpoints": [
                "A big toothy wolf knocked on the straw house and demanded to enter.",
                "The wolf huffed, puffed, and blew down the straw house.",
            ],
            "key_terms": [],
        }
    ],
}


def test_flatten_note_fields_uses_study_paths():
    fields = flatten_note_fields(STORY_NOTES)
    assert fields["summary"].startswith("The wolf huffed")
    assert "sections.0.subpoints.1" in fields
    assert "title" not in fields


def test_ground_highlights_keeps_verbatim_phrases_only():
    proposals = [
        {"path": "summary", "text": "huffed and puffed"},
        {"path": "summary", "text": "Doctrine of Intergenerational Responsibility"},
        {"path": "sections.0.subpoints.0", "text": "straw house"},
        {"path": "sections.0.subpoints.1", "text": "a phrase that is not in the notes"},
        {"path": "missing.path", "text": "straw house"},
    ]
    grounded = ground_highlights(STORY_NOTES, proposals)
    texts = [item["text"].lower() for item in grounded]
    assert "huffed and puffed" in texts
    assert "straw house" in texts
    assert all("intergenerational" not in text for text in texts)
    assert all("not in the notes" not in text for text in texts)
    assert all(item["source"] == "auto" for item in grounded)


def test_ground_highlights_skips_whole_paragraph_paints():
    proposals = [{"path": "summary", "text": STORY_NOTES["summary"]}]
    assert ground_highlights(STORY_NOTES, proposals) == []


def test_notes_highlights_endpoint_grounds_model_output(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import gemini_service as gemini_mod
    import io

    client = TestClient(app)
    auth = {"Authorization": "Bearer demo-token"}
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("pigs.txt", io.BytesIO(b"The wolf huffed and puffed."), "text/plain")},
        headers=auth,
    )
    assert upload.status_code in (200, 202)
    created = client.post(
        "/api/sessions",
        json={"title": "Pigs", "document_id": upload.json()["id"]},
        headers=auth,
    )
    session_id = created.json()["id"]
    client.put(
        f"/api/sessions/{session_id}/notes",
        json={
            "content": {
                "title": "Pigs",
                "summary": "The wolf huffed and puffed until the straw house fell.",
                "sections": [{"heading": "Attack", "subpoints": ["The straw house fell down."], "key_terms": []}],
            }
        },
        headers=auth,
    )

    async def fake_generate(content):
        return [
            {
                "path": "summary",
                "start": 9,
                "end": 26,
                "text": "huffed and puffed",
                "kind": "highlight",
                "color": "yellow",
                "source": "auto",
            }
        ]

    monkeypatch.setattr(gemini_mod.gemini_service, "generate_note_highlights", fake_generate)
    response = client.post(f"/api/sessions/{session_id}/notes/highlights", headers=auth)
    assert response.status_code == 200, response.text
    highlights = response.json()["highlights"]
    assert highlights[0]["text"] == "huffed and puffed"
    assert highlights[0]["source"] == "auto"
    saved = client.get(f"/api/sessions/{session_id}/notes", headers=auth)
    assert saved.status_code == 200, saved.text
    marks = saved.json()["content"].get("presentation", {}).get("marks", [])
    assert any(mark.get("text") == "huffed and puffed" and mark.get("source") == "auto" for mark in marks)
