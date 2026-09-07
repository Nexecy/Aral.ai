#!/usr/bin/env bash
# Idempotent bootstrap for the Aral.ai Cloud Agent environment.
# Installs backend (FastAPI/Python) and frontend (Next.js) dependencies.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ensurepip/venv support is not bundled with the base python3.12 on Debian/Ubuntu.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends python3.12-venv
fi

# Backend: virtualenv + pinned requirements.
cd "$ROOT_DIR/backend"
if [ ! -x venv/bin/python ]; then
  python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Local env file (secrets stay empty; the app has in-memory/local fallbacks).
[ -f .env ] || cp .env.example .env

# Frontend: npm dependencies from the committed lockfile.
cd "$ROOT_DIR/frontend"
npm ci || npm install
[ -f .env.local ] || cp .env.example .env.local

echo "Aral.ai environment bootstrap complete."
