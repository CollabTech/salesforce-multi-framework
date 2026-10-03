#!/usr/bin/env bash
# SMF-9 REC-01 (network loss ×3) and REC-03 (leave/rejoin ×3) on cloud desktop rows during a
# real RealtimeKit call (fake devices). Mobile interruptions (network switch, background,
# lock, incoming call) are human (docs/test-scripts/SMF-9-RECOVERY.md).
# needs: 30 40 45
set -uo pipefail
[ -f private/smf7/realtimekit.json ] || { echo "BLOCKED: stage 45 has not prepared RealtimeKit"; exit 2; }
cd testing/cloud-e2e && npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-9-recovery.spec.ts
else npx playwright test tests/smf-9-recovery.spec.ts; fi
