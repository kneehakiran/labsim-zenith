#!/usr/bin/env bash
# Runs the UI tests against a REAL backend: starts FastAPI on a temporary database,
# creates a faculty account, runs vitest, then cleans up.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-8765}"
TMP="$(mktemp -d)"
export LABSIM_DB="$TMP/e2e.db"
export LABSIM_FACULTY_PASSWORD="e2e-password-1"

( cd backend && python3 create_faculty.py --id F001 --name "Dr Rao" --department Chemistry >/dev/null )
( cd backend && python3 seed.py >/dev/null )   # the real student and faculty lists
( cd backend && exec python3 -m uvicorn app.main:app --port "$PORT" --log-level warning ) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$TMP"' EXIT

for _ in $(seq 1 50); do
  curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.2
done
curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null || { echo "backend did not start"; exit 1; }

VITE_API_URL="http://127.0.0.1:$PORT" E2E_FACULTY_PASSWORD="$LABSIM_FACULTY_PASSWORD" npx vitest run "$@"
