#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INTERNAL_SNAPSHOT="$(mktemp)"

cleanup() {
  rm -f "$INTERNAL_SNAPSHOT"
}
trap cleanup EXIT

cd "$ROOT"

# Syntax-check every executable source family before running generators.
python3 -m py_compile scripts/*.py
find scripts -type f -name '*.sh' -print0 | xargs -0 -n1 bash -n
find scripts public -type f \( -name '*.js' -o -name '*.mjs' \) -print0 \
  | xargs -0 -n1 node --check

# The internal operations app is deployed from public/ but owns a separate UI
# contract. Marketing generators must never rewrite or prune it.
find public/primetime -type f -print0 | sort -z | xargs -0 sha256sum > "$INTERNAL_SNAPSHOT"

python3 scripts/restore_owner_attested_content.py
node scripts/site-polish.mjs
node scripts/site-polish-finalize.mjs
python3 scripts/seo_foundation.py
python3 scripts/accessibility_foundation.py
node scripts/performance_foundation.mjs
node scripts/frontend_controls.mjs

node scripts/verify-site-output.mjs
python3 scripts/generate_sensitive_term_register.py
python3 scripts/verify_batch_a.py
python3 scripts/verify_batch_b1.py
python3 scripts/verify_batch_b2.py
python3 scripts/verify_batch_b3.py
python3 scripts/verify_batch_b4.py
python3 scripts/verify_structured_navigation.py
python3 scripts/verify_accessibility_foundation.py
node scripts/verify_performance_foundation.mjs
node scripts/verify_performance_budgets.mjs
node scripts/verify_frontend_controls.mjs
python3 scripts/verify_owner_content.py
python3 scripts/repository_audit.py

diff -u "$INTERNAL_SNAPSHOT" <(
  find public/primetime -type f -print0 | sort -z | xargs -0 sha256sum
)

# A deployment must not contain uncommitted changes generated at release time.
# This prevents a docs-only push from silently publishing different site data.
git diff --exit-code -- \
  public \
  scripts \
  PTHHS_SENSITIVE_TERM_REGISTER.csv \
  firebase.json

echo "PTHHS_BUILD_AND_VERIFICATION: PASS"
