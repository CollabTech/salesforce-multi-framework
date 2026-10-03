#!/usr/bin/env bash
# SMF-11 MARK-01 (mouse) .. MARK-04 as real personas in Edge / Chromium. Touch on physical
# Salesforce mobile stays human (testing/HUMAN-ACTIONS.md, docs/test-scripts/SMF-11-MARKUP.md).
# Optional: SMF_INLET_BOX="x,y,w,h" (MF-IMAGE-001 inlet, image pixels, from the SMF-3 fixture manifest).
# needs: 30 40 45 46 52
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 30)"; exit 2; }
done
[ -f testing/cloud-e2e/tests/persona.ts ] || { echo "BLOCKED: cloud-e2e framework (persona.ts) not in this checkout"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-11-markup.spec.ts; else npx playwright test tests/smf-11-markup.spec.ts; fi
