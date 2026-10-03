#!/usr/bin/env bash
# SMF-10 FILE-01..03 (+ desktop half of FILE-04) as real personas in Edge / Chromium.
# Physical Salesforce mobile rows stay human (testing/HUMAN-ACTIONS.md, docs/test-scripts/SMF-10-FILES.md).
# needs: 30 40 46
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 30)"; exit 2; }
done
[ -f testing/cloud-e2e/tests/persona.ts ] || { echo "BLOCKED: cloud-e2e framework (persona.ts) not in this checkout"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-10-files.spec.ts; else npx playwright test tests/smf-10-files.spec.ts; fi
