#!/usr/bin/env bash
# SMF-6 CAP-01..03 cloud desktop rows (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM) as MF-TECH with
# FAKE camera/mic: probe logic + track lifecycle in the real Salesforce host only. Real
# camera/mic capability and both mobile rows are human (docs/test-scripts/SMF-6-CAPTURE.md).
# needs: 30 40
set -uo pipefail
sf org display --target-org smf-dev-tech --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias smf-dev-tech missing (stage 30)"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-6-capture.spec.ts
else npx playwright test tests/smf-6-capture.spec.ts; fi
