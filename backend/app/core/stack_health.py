from typing import Any, Dict, List

APP_VERSION = "1.0.4"


def build_health_payload() -> Dict[str, Any]:
    from app.core.config import settings

    return {
        "app": "Aral.ai API",
        "version": APP_VERSION,
        "status": "operational",
        "docs": "/docs",
        "mode": "hybrid",
        "environment": settings.ENVIRONMENT,
        "hosted": settings.is_hosted,
        "anonymous_auth": settings.allow_anonymous_auth,
        "frontend_origin": settings.frontend_origin,
        "gemini_active": settings.has_gemini_key,
        "supabase_active": settings.has_supabase_credentials,
    }


def evaluate_health(
    payload: Any,
    *,
    require_gemini: bool = False,
    require_supabase: bool = False,
) -> List[str]:
    if not isinstance(payload, dict):
        return ["health response is not a JSON object"]

    problems: List[str] = []
    status = payload.get("status")
    if status != "operational":
        problems.append(f"API status is {status!r}, expected 'operational'")

    if require_gemini and not payload.get("gemini_active"):
        problems.append("Gemini is not configured (set GEMINI_API_KEY)")
    if require_supabase and not payload.get("supabase_active"):
        problems.append("Supabase is not configured (set SUPABASE_URL and SUPABASE_KEY)")

    env = str(payload.get("environment") or "").strip().lower()
    hosted = bool(payload.get("hosted"))
    if (env in {"production", "prod"} or hosted) and payload.get("anonymous_auth"):
        problems.append("anonymous auth is enabled on a hosted/production API")

    return problems


def health_url(base_url: str) -> str:
    url = (base_url or "").strip().rstrip("/")
    if not url:
        raise ValueError("base URL is required")
    if url.endswith("/api"):
        return f"{url}/health"
    return f"{url}/api/health"


def fetch_health(base_url: str, timeout: float = 5.0) -> Dict[str, Any]:
    import json
    import urllib.error
    import urllib.request

    url = health_url(base_url)
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"health check HTTP {exc.code} from {url}") from exc
    except Exception as exc:
        raise RuntimeError(f"could not reach {url}: {exc}") from exc
