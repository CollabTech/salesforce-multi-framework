#!/usr/bin/env bash
# SMF-3 DATA-02 in cloud desktop browsers (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM; Chrome only when
# SMF_CHROME=1 after H1): each persona's own session opens MF-CASE-001/002 and fetches
# MF-IMAGE-001/MF-FILE-DENIED. Independent of the SMF-4 app (record pages only).
# Not a substitute for interactive password/MFA login or physical mobile rows (human-only).
# needs: 31 32
set -uo pipefail
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 31)"; exit 2; }
done
cd testing/cloud-e2e || { echo "BLOCKED: testing/cloud-e2e harness missing (integrator SMF-2 framework)"; exit 2; }
npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-3-access.spec.ts
else npx playwright test tests/smf-3-access.spec.ts; fi
rc=$?
cd ../..
[ -f scripts/cloud/ingest-observations.py ] && python3 scripts/cloud/ingest-observations.py
[ $rc -eq 0 ] && exit 0 || { echo "[51] DATA-02 browser checks failed (observations in testing/cloud-e2e/results)"; exit 2; }
