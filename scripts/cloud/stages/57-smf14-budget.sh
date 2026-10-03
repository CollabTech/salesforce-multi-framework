#!/usr/bin/env bash
# SMF-14 cloud e2e: BUDGET-03 delivery/denial as MF-TECH and MF-RESTRICTED in Microsoft Edge
# (ENV-DESKTOP-EDGE) and Playwright Chromium (ENV-CLOUD-CHROMIUM); the BUDGET-01/02 harness as a
# separate software-rendered cloud row. Device budgets, rotation and mobile foreground recovery
# stay human-only. Needs the SMF10_Access assignment (stage 46) and the model Files (stage 47).
# needs: 30 40 46 47
set -uo pipefail
for a in smf-dev-tech smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (SMF-3 stage 30 / owner setup H1-H2)"; exit 2; }
done
[ -f private/smf14-model-files.json ] || { echo "BLOCKED: private/smf14-model-files.json missing (run stage 47)"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-14-budget.spec.ts; else npx playwright test tests/smf-14-budget.spec.ts; fi
rc=$?; cd ../..
if [ -f scripts/cloud/ingest-observations.py ]; then python3 scripts/cloud/ingest-observations.py; fi
exit $rc
