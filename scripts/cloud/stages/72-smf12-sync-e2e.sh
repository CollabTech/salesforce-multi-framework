#!/usr/bin/env bash
# SMF-12 SYNC-01..03 (+ desktop half of SYNC-04) as real personas in Edge / Chromium against the
# deployed Worker. Physical-mobile pairs (SYNC-04) stay human (docs/test-scripts/SMF-12-SYNC.md).
# needs: 30 40 46 48 49
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 30)"; exit 2; }
done
[ -f testing/cloud-e2e/tests/persona.ts ] || { echo "BLOCKED: cloud-e2e framework (persona.ts) not in this checkout"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-12-sync.spec.ts; else npx playwright test tests/smf-12-sync.spec.ts; fi
