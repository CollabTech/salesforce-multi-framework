#!/usr/bin/env bash
# SMF-7 CALL-01..03 cloud desktop rows (incl. A1 access-change runs: baseline, then sweep enforced) (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM) as MF-TECH,
# MF-SUPPORT and MF-RESTRICTED against the real Apex boundary and RealtimeKit, fake devices.
# Audio heard / video seen and all mobile rows stay human (docs/test-scripts/SMF-7-CALL.md).
# needs: 30 40 45
set -uo pipefail
[ -n "${CF_ACCOUNT_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ] || { echo "BLOCKED: CF_ACCOUNT_ID/CF_API_TOKEN missing (revoked-token control needs them)"; exit 2; }
[ -f private/smf7/realtimekit.json ] || { echo "BLOCKED: stage 45 has not prepared RealtimeKit"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-7-call.spec.ts
else npx playwright test tests/smf-7-call.spec.ts; fi
