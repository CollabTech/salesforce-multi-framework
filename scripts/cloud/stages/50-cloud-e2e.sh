#!/usr/bin/env bash
# SMF-4 HOST-01/02: cloud browser automation as real personas (Edge + Chromium).
# Other stories run their own specs from their own 5x stages.
# Not a substitute for physical Salesforce mobile or observed audio/video (human-only).
# needs: 30 40
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 30)"; exit 2; }
done
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/host.spec.ts; else npx playwright test tests/host.spec.ts; fi
rc=$?; cd ../..; [ -f scripts/cloud/ingest-observations.py ] && python3 scripts/cloud/ingest-observations.py; exit $rc
