#!/usr/bin/env bash
# SMF-5 PKG-01 + PKG-03 in cloud desktop browsers (ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM as a
# separate row) as the subscriber personas; expects the v1 marker. Physical Salesforce
# mobile is human-only (testing/HUMAN-ACTIONS.md).
# needs: 62
set -uo pipefail
cd testing/cloud-e2e || exit 1
npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then
  SMF_PKG_EXPECT=v1 SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-5-package.spec.ts --grep "PKG-01|PKG-03"
else
  SMF_PKG_EXPECT=v1 npx playwright test tests/smf-5-package.spec.ts --grep "PKG-01|PKG-03"
fi
