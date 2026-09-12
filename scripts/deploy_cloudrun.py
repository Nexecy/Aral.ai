"""
Deploy the FastAPI backend to Google Cloud Run.

Prereqs (one-time, in your own terminal):
    winget install Google.CloudSDK
    gcloud auth login
    gcloud auth application-default login
    gcloud config set project YOUR_PROJECT_ID

Then from the repo root:
    python scripts/deploy_cloudrun.py
    python scripts/deploy_cloudrun.py --project YOUR_PROJECT_ID --region us-central1
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
ENV_FILE = BACKEND / ".env"

# Cloud Run --env-vars-file is comma-hostile; CORS_ORIGINS has commas, so YAML wins.
SKIP_ENV_KEYS = {"PORT", "HOST"}
REQUIRED_ENV_KEYS = ("GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY")

GCLOUD_CANDIDATES = (
    Path(r"C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"),
    Path(r"C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"),
    Path.home() / "AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd",
    Path.home() / "google-cloud-sdk/bin/gcloud",
)


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def find_gcloud() -> str:
    found = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    if found:
        return found
    for candidate in GCLOUD_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    sys.exit(
        "Google Cloud SDK (gcloud) is not installed or not on PATH.\n"
        "On Windows: winget install Google.CloudSDK\n"
        "Then open a new terminal and run: gcloud auth login"
    )


def run_gcloud(gcloud: str, args: list[str], *, capture: bool = False) -> str:
    command = [gcloud, *args]
    result = subprocess.run(
        command,
        check=False,
        capture_output=capture,
        text=True,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        pretty = " ".join(args)
        sys.exit(f"gcloud {pretty} failed (exit {result.returncode}).\n{err}")
    return (result.stdout or "").strip() if capture else ""


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        sys.exit(f"Missing {path}. Copy backend/.env.example to backend/.env and fill in keys.")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def write_env_vars_file(values: dict[str, str], dest: Path) -> None:
    payload = dict(values)
    frontend = payload.get("FRONTEND_URL", "")
    production_frontend = payload.get("PRODUCTION_FRONTEND_URL") or "https://aral-ai-three.vercel.app"
    if "localhost" in frontend or "127.0.0.1" in frontend:
        payload["FRONTEND_URL"] = production_frontend
    lines = ["ENVIRONMENT: production"]
    for key, value in payload.items():
        if key in SKIP_ENV_KEYS or key == "ENVIRONMENT" or not value:
            continue
        lines.append(f"{key}: {yaml_quote(value)}")
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")


BUILD_SA_ROLES = (
    "roles/cloudbuild.builds.builder",
    "roles/artifactregistry.writer",
    "roles/logging.logWriter",
    "roles/storage.objectViewer",
)


def grant_project_role(gcloud: str, project: str, member: str, role: str) -> None:
    result = subprocess.run(
        [
            gcloud,
            "projects",
            "add-iam-policy-binding",
            project,
            f"--member={member}",
            f"--role={role}",
            "--quiet",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip().splitlines()
        print(f"Warning: could not grant {role} to {member}")
        if err:
            print(err[-1])
        return
    print(f"Granted {role}")


def ensure_build_permissions(gcloud: str, project: str) -> None:
    """New orgs no longer give the Compute default SA Editor; Cloud Build needs these."""
    number = run_gcloud(
        gcloud,
        ["projects", "describe", project, "--format=value(projectNumber)"],
        capture=True,
    )
    compute_sa = f"serviceAccount:{number}-compute@developer.gserviceaccount.com"
    print(f"Granting Cloud Build roles to {number}-compute@developer.gserviceaccount.com")
    for role in BUILD_SA_ROLES:
        grant_project_role(gcloud, project, compute_sa, role)

    bucket = f"gs://{project}_cloudbuild"
    result = subprocess.run(
        [
            gcloud,
            "storage",
            "buckets",
            "add-iam-policy-binding",
            bucket,
            f"--member={compute_sa}",
            "--role=roles/storage.objectViewer",
            f"--project={project}",
            "--quiet",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Note: could not bind objectViewer on {bucket} yet (it is created on first build).")
    else:
        print(f"Granted objectViewer on {bucket}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Deploy Aral.ai API to Cloud Run")
    parser.add_argument("--project", default=os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT") or "")
    parser.add_argument("--region", default=os.getenv("GCP_REGION") or "us-central1")
    parser.add_argument("--service", default="aral-ai-api")
    parser.add_argument("--memory", default="2Gi")
    parser.add_argument("--cpu", default="1")
    args = parser.parse_args(argv)

    gcloud = find_gcloud()
    account = run_gcloud(
        gcloud,
        ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
        capture=True,
    )
    if not account:
        sys.exit(
            "gcloud is installed but no account is logged in.\n"
            "In your own terminal run:\n"
            "  gcloud auth login\n"
            "  gcloud auth application-default login\n"
            "  gcloud config set project YOUR_PROJECT_ID"
        )

    project = args.project or run_gcloud(
        gcloud, ["config", "get-value", "project"], capture=True
    )
    if not project or project == "(unset)":
        sys.exit("No GCP project. Pass --project YOUR_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID")

    env_values = load_dotenv(ENV_FILE)
    missing = [key for key in REQUIRED_ENV_KEYS if len(env_values.get(key, "").strip()) < 5]
    if missing:
        sys.exit(f"backend/.env is missing required values: {', '.join(missing)}")

    print(f"Deploying {args.service} to Cloud Run as {account} / {project} / {args.region}")
    print("Memory 2Gi, CPU always allocated (PDF background parse), scale-to-zero, timeout 900s.")

    run_gcloud(
        gcloud,
        [
            "services",
            "enable",
            "run.googleapis.com",
            "artifactregistry.googleapis.com",
            "cloudbuild.googleapis.com",
            "storage.googleapis.com",
            "--project",
            project,
        ],
    )
    ensure_build_permissions(gcloud, project)

    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8") as handle:
        env_vars_path = Path(handle.name)
    try:
        write_env_vars_file(env_values, env_vars_path)
        run_gcloud(
            gcloud,
            [
                "run",
                "deploy",
                args.service,
                "--source",
                str(BACKEND),
                "--project",
                project,
                "--region",
                args.region,
                "--memory",
                args.memory,
                "--cpu",
                args.cpu,
                "--timeout",
                "900",
                "--concurrency",
                "8",
                "--min-instances",
                "0",
                "--max-instances",
                "3",
                "--cpu-boost",
                "--no-cpu-throttling",
                "--execution-environment",
                "gen2",
                "--port",
                "8080",
                "--quiet",
                # Public access without binding allUsers (blocked by org domain-restricted sharing).
                "--no-invoker-iam-check",
                "--env-vars-file",
                str(env_vars_path),
            ],
        )
    finally:
        env_vars_path.unlink(missing_ok=True)

    url = run_gcloud(
        gcloud,
        [
            "run",
            "services",
            "describe",
            args.service,
            "--project",
            project,
            "--region",
            args.region,
            "--format=value(status.url)",
        ],
        capture=True,
    )
    api = f"{url.rstrip('/')}/api"
    print()
    print(f"Cloud Run URL: {url}")
    print(f"API base:      {api}")
    print()
    print("Point the Vercel frontend at this API:")
    print(f"  NEXT_PUBLIC_API_URL={api}")
    print("Then redeploy the frontend.")
    print()
    print("Check the hosted stack:")
    print(f"  python scripts/check_stack.py --base-url {url} --require-gemini --require-supabase")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
