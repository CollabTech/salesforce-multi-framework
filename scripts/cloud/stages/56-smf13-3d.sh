#!/usr/bin/env bash
# SMF-13 cloud e2e: 3D-01 (MF-TECH, MF-SUPPORT) and 3D-03 (MF-TECH) on the deployed app in
# Microsoft Edge (ENV-DESKTOP-EDGE) and Playwright Chromium (ENV-CLOUD-CHROMIUM), plus the
# 3D-02 60 s run as a separate software-rendered cloud row (never a device judgement).
# Touch, rotation, device performance and physical Salesforce mobile stay human-only.
# needs: 30 40
set -uo pipefail
for a in smf-dev-tech smf-dev-support; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (SMF-3 stage 30 / owner setup H1-H2)"; exit 2; }
done
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-13-3d.spec.ts; else npx playwright test tests/smf-13-3d.spec.ts; fi
rc=$?; cd ../..
if [ -f scripts/cloud/ingest-observations.py ]; then python3 scripts/cloud/ingest-observations.py; fi
exit $rc
