#!/usr/bin/env bash
# SMF-8 SHARE-01..03 cloud desktop rows (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM): MF-SUPPORT shares
# a FAKE desktop to MF-TECH through RealtimeKit; cancel is stubbed. Seeing the diagnostic screen,
# the real picker and every mobile row stay human (docs/test-scripts/SMF-8-SHARE.md).
# needs: 30 40 45
set -uo pipefail
[ -f private/smf7/realtimekit.json ] || { echo "BLOCKED: stage 45 has not prepared RealtimeKit"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-8-share.spec.ts
else npx playwright test tests/smf-8-share.spec.ts; fi
