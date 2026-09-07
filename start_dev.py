"""
Aral.ai — Unified Development Server Launcher

Starts FastAPI (port 8000) and Next.js (port 3005), then waits until the API
health endpoint responds so the UI is not opened against a dead backend.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

BACKEND_PORT = 8000
FRONTEND_PORT = 3005
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
HEALTH_WAIT_SECONDS = 40


def _venv_python(backend_dir: str) -> str:
    candidates = [
        os.path.join(backend_dir, "venv", "Scripts", "python.exe"),
        os.path.join(backend_dir, "venv", "bin", "python"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return sys.executable


def _wait_for_backend(backend_proc: subprocess.Popen) -> dict:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(backend_dir, "backend"))
    from app.core.stack_health import evaluate_health, fetch_health

    deadline = time.time() + HEALTH_WAIT_SECONDS
    last_error = "backend did not become ready"
    while time.time() < deadline:
        if backend_proc.poll() is not None:
            raise RuntimeError(
                f"backend exited with code {backend_proc.returncode} before health passed"
            )
        try:
            payload = fetch_health(BACKEND_URL, timeout=2)
            problems = evaluate_health(payload)
            if problems:
                print("Backend is up, with warnings:")
                for item in problems:
                    print(f"  - {item}")
            else:
                print(
                    "Backend health OK "
                    f"(gemini={payload.get('gemini_active')} "
                    f"supabase={payload.get('supabase_active')})"
                )
            if not payload.get("gemini_active"):
                print("  warning: GEMINI_API_KEY missing — notes/chat will use heuristics")
            if not payload.get("supabase_active"):
                print("  warning: Supabase is not configured — data stays in memory")
            return payload
        except Exception as exc:
            last_error = str(exc)
            time.sleep(0.4)
    raise RuntimeError(f"timed out waiting for {BACKEND_URL}/api/health ({last_error})")


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    venv_python = _venv_python(backend_dir)

    print("=" * 66)
    print("  Starting Aral.ai full-stack development environment")
    print("=" * 66)
    print(f"  Backend:  {BACKEND_URL}  (docs {BACKEND_URL}/docs)")
    print(f"  Frontend: http://localhost:{FRONTEND_PORT}")
    print(f"  Health:   python scripts/check_stack.py")
    print("=" * 66)

    backend_cmd = [
        venv_python,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        str(BACKEND_PORT),
    ]
    backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir)

    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)

    try:
        _wait_for_backend(backend_proc)
        print(f"Open http://localhost:{FRONTEND_PORT} when Next.js finishes compiling.")
        while True:
            if backend_proc.poll() is not None:
                print(f"Backend exited with code {backend_proc.returncode}. Stopping frontend.")
                frontend_proc.terminate()
                sys.exit(backend_proc.returncode or 1)
            if frontend_proc.poll() is not None:
                print(f"Frontend exited with code {frontend_proc.returncode}. Stopping backend.")
                backend_proc.terminate()
                sys.exit(frontend_proc.returncode or 1)
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Aral.ai servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")
    except Exception as exc:
        print(f"Startup failed: {exc}")
        backend_proc.terminate()
        frontend_proc.terminate()
        sys.exit(1)


if __name__ == "__main__":
    main()
