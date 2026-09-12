"""Deployment and local-runtime guarantees: CORS, anonymous auth, health."""

from starlette.middleware.cors import CORSMiddleware

from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.main import app

client = TestClient(app)


def _cors_kwargs():
    matches = [m for m in app.user_middleware if m.cls is CORSMiddleware]
    assert matches, "CORSMiddleware must be registered on the FastAPI app"
    return matches[0].kwargs


def test_cors_middleware_uses_settings_origin_list():
    kwargs = _cors_kwargs()
    assert kwargs["allow_origins"] == settings.cors_origins_list
    assert kwargs["allow_credentials"] is True
    assert kwargs["max_age"] == 86400
    assert kwargs["allow_origin_regex"] == settings.cors_origin_regex


def test_cors_origins_always_include_dev_ports_and_custom_domains():
    configured = Settings(
        CORS_ORIGINS="https://aral.ai",
        FRONTEND_URL="http://localhost:3005",
        PRODUCTION_FRONTEND_URL="https://aral-ai-three.vercel.app",
    )
    origins = configured.cors_origins_list
    assert "http://localhost:3005" in origins
    assert "http://localhost:3000" in origins
    assert "https://aral.ai" in origins
    assert "https://aral-ai-three.vercel.app" in origins


def test_cors_preflight_allows_current_dev_frontend():
    headers = {
        "Origin": "http://localhost:3005",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
    }
    response = client.options("/api/auth/login", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3005"
    assert response.headers.get("access-control-max-age") == "86400"


def test_cors_preflight_allows_vercel_preview_deployments():
    origin = "https://aral-ai-three-git-feat-preview.vercel.app"
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    }
    response = client.options("/api/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin


def test_health_reports_deployment_fields():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["app"] == "Aral.ai API"
    assert "environment" in data
    assert "hosted" in data
    assert "anonymous_auth" in data
    assert "frontend_origin" in data
    assert isinstance(data["gemini_active"], bool)
    assert isinstance(data["supabase_active"], bool)
    assert data["anonymous_auth"] is True


def test_production_rejects_missing_bearer_token(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "authorization" in response.json()["detail"].lower() or "token" in response.json()["detail"].lower()


def test_production_rejects_demo_token(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = client.get("/api/sessions", headers={"Authorization": "Bearer demo-token"})
    assert response.status_code == 401


def test_render_hosting_rejects_anonymous_requests_even_in_development(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setenv("RENDER", "true")
    response = client.get("/api/documents")
    assert response.status_code == 401


def test_cloud_run_is_detected_as_hosted(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setenv("K_SERVICE", "aral-ai-api")
    assert settings.is_hosted is True
    assert settings.is_production is True
    assert settings.allow_anonymous_auth is False


def test_cloud_run_hosting_rejects_anonymous_requests_even_in_development(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setenv("K_SERVICE", "aral-ai-api")
    response = client.get("/api/documents")
    assert response.status_code == 401


def test_cloud_run_frontend_origin_replaces_localhost(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "aral-ai-api")
    configured = Settings(
        ENVIRONMENT="development",
        FRONTEND_URL="http://localhost:3005",
        PRODUCTION_FRONTEND_URL="https://aral-ai-three.vercel.app",
    )
    assert configured.is_hosted is True
    assert configured.frontend_origin == "https://aral-ai-three.vercel.app"


def test_development_still_accepts_demo_token():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer demo-token"})
    assert response.status_code == 200
    assert response.json()["email"] == "local-account"


def test_health_stays_public_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["anonymous_auth"] is False
