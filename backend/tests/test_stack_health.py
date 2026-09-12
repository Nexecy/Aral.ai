from app.core.stack_health import evaluate_health, health_url


def test_evaluate_health_accepts_operational_payload():
    problems = evaluate_health(
        {
            "status": "operational",
            "gemini_active": True,
            "supabase_active": True,
            "environment": "development",
            "hosted": False,
            "anonymous_auth": True,
        }
    )
    assert problems == []


def test_evaluate_health_rejects_non_operational_status():
    problems = evaluate_health({"status": "down"})
    assert any("operational" in item for item in problems)


def test_evaluate_health_can_require_gemini_and_supabase():
    payload = {
        "status": "operational",
        "gemini_active": False,
        "supabase_active": False,
        "environment": "development",
        "hosted": False,
        "anonymous_auth": True,
    }
    problems = evaluate_health(payload, require_gemini=True, require_supabase=True)
    assert any("Gemini" in item for item in problems)
    assert any("Supabase" in item for item in problems)


def test_evaluate_health_flags_anonymous_auth_on_hosted_api():
    problems = evaluate_health(
        {
            "status": "operational",
            "gemini_active": True,
            "supabase_active": True,
            "environment": "development",
            "hosted": True,
            "anonymous_auth": True,
        }
    )
    assert any("anonymous" in item.lower() for item in problems)


def test_evaluate_health_rejects_non_object_payload():
    problems = evaluate_health("not-json")
    assert problems


def test_health_url_accepts_host_or_api_prefix():
    assert health_url("http://localhost:8000") == "http://localhost:8000/api/health"
    assert health_url("http://localhost:8000/") == "http://localhost:8000/api/health"
    assert health_url("https://aral-ai.onrender.com/api") == "https://aral-ai.onrender.com/api/health"
    assert (
        health_url("https://aral-ai-api-686935671952.us-central1.run.app/api")
        == "https://aral-ai-api-686935671952.us-central1.run.app/api/health"
    )
