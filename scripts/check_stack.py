"""
Probe the Aral.ai API health endpoint.

Usage (from the repo root):
    python scripts/check_stack.py
    python scripts/check_stack.py --base-url https://aral-ai.onrender.com
    python scripts/check_stack.py --require-gemini --require-supabase
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.core.stack_health import evaluate_health, fetch_health, health_url  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check Aral.ai API health")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="API origin or .../api prefix (default: http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=8.0,
        help="HTTP timeout in seconds",
    )
    parser.add_argument(
        "--require-gemini",
        action="store_true",
        help="Fail if GEMINI_API_KEY is not active",
    )
    parser.add_argument(
        "--require-supabase",
        action="store_true",
        help="Fail if Supabase is not configured",
    )
    args = parser.parse_args(argv)

    try:
        payload = fetch_health(args.base_url, timeout=args.timeout)
    except Exception as exc:
        print(f"FAIL  {exc}")
        print(f"      tried {health_url(args.base_url)}")
        return 1

    problems = evaluate_health(
        payload,
        require_gemini=args.require_gemini,
        require_supabase=args.require_supabase,
    )

    print(f"OK    {payload.get('app')} {payload.get('version')}  status={payload.get('status')}")
    print(
        "      "
        f"environment={payload.get('environment')}  "
        f"hosted={payload.get('hosted')}  "
        f"anonymous_auth={payload.get('anonymous_auth')}"
    )
    print(
        "      "
        f"gemini={payload.get('gemini_active')}  "
        f"supabase={payload.get('supabase_active')}  "
        f"frontend={payload.get('frontend_origin')}"
    )

    if problems:
        for item in problems:
            print(f"FAIL  {item}")
        return 1

    print("OK    stack health passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
