#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly PORT="${PORT:-8765}"

cd "$ROOT"
env PORT="$PORT" node scripts/serve-static.mjs >/dev/null 2>&1 &
readonly SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in {1..30}; do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${PORT}/', timeout=1)" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

BASE_URL="http://127.0.0.1:${PORT}" node scripts/verify_responsive_shell.mjs
BASE_URL="http://127.0.0.1:${PORT}" node scripts/verify_accessibility_browser.mjs
BASE_URL="http://127.0.0.1:${PORT}" node scripts/verify_performance_budgets.mjs --browser
