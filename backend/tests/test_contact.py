import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.email_service import (
    render_team_notification_html,
    render_student_auto_reply_html,
    email_service,
    EmailService,
)

client = TestClient(app)


def test_render_email_templates():
    team_html = render_team_notification_html(
        name="Matt Tester",
        email="matt@example.com",
        topic="General Inquiry",
        message="Are there any subscriptions?",
        platform="Web Client",
    )
    assert "Matt Tester" in team_html
    assert "matt@example.com" in team_html
    assert "General Inquiry" in team_html
    assert "Are there any subscriptions?" in team_html
    assert "Reply Directly to Matt Tester" in team_html

    student_html = render_student_auto_reply_html(
        name="Matt Tester",
        topic="General Inquiry",
        message="Are there any subscriptions?",
    )
    assert "Thanks for reaching out, Matt Tester!" in student_html
    assert "General Inquiry" in student_html
    assert "Are there any subscriptions?" in student_html


def test_contact_endpoint_success():
    payload = {
        "name": "Matt Chen",
        "email": "matt.chen@university.edu",
        "topic": "Feature Suggestion",
        "message": "I would love to see anki flashcard export!",
        "platform": "Web Client",
    }
    with patch.object(email_service, "_send_smtp", return_value=True):
        response = client.post("/api/contact", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "message" in data


def test_contact_endpoint_validation():
    # Empty name
    response = client.post("/api/contact", json={"name": "", "email": "a@b.com", "message": "hello"})
    assert response.status_code in (400, 422)

    # Missing message
    response = client.post("/api/contact", json={"name": "Matt", "email": "a@b.com"})
    assert response.status_code in (400, 422)


from unittest.mock import PropertyMock

@pytest.mark.asyncio
async def test_email_service_smtp_mocked():
    with patch.object(email_service, "_send_smtp", return_value=True):
        with patch.object(EmailService, "is_configured", new_callable=PropertyMock, return_value=True):
            result = await email_service.send_contact_inquiry(
                name="Alex",
                email="alex@example.com",
                topic="Technical Support",
                message="Cannot load documents",
            )
            assert result["sent"] is True
            assert result["team_delivered"] is True
            assert result["student_delivered"] is True
