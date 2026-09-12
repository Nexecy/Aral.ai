import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from deploy_cloudrun import write_env_vars_file  # noqa: E402


def test_env_vars_file_quotes_cors_and_rewrites_localhost_frontend(tmp_path):
    dest = tmp_path / "env.yaml"
    write_env_vars_file(
        {
            "ENVIRONMENT": "development",
            "PORT": "8000",
            "HOST": "0.0.0.0",
            "FRONTEND_URL": "http://localhost:3005",
            "PRODUCTION_FRONTEND_URL": "https://aral-ai-three.vercel.app",
            "CORS_ORIGINS": "http://localhost:3005,https://aral-ai-three.vercel.app",
            "GEMINI_API_KEY": "test-key",
        },
        dest,
    )
    text = dest.read_text(encoding="utf-8")
    assert "ENVIRONMENT: production" in text
    assert "PORT:" not in text
    assert "HOST:" not in text
    assert 'FRONTEND_URL: "https://aral-ai-three.vercel.app"' in text
    assert (
        'CORS_ORIGINS: "http://localhost:3005,https://aral-ai-three.vercel.app"'
        in text
    )
    assert 'GEMINI_API_KEY: "test-key"' in text
