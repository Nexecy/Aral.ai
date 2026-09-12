import os

import pytest

from app.core.config import settings

# Hosted platforms set these automatically. Tests must not inherit that
# identity unless they opt in — otherwise demo-token fixtures 401.
os.environ.pop("K_SERVICE", None)
os.environ.pop("CLOUD_RUN_JOB", None)
os.environ.pop("RENDER", None)
os.environ.pop("RENDER_EXTERNAL_URL", None)


@pytest.fixture(autouse=True)
def isolate_runtime(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.delenv("CLOUD_RUN_JOB", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
