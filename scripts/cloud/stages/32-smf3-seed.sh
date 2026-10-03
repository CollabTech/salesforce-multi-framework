#!/usr/bin/env bash
# SMF-3 DATA-01: seed the synthetic fixtures twice (idempotent seed + Files) and compare counts and
# logical identities. Sanitized result -> evidence/SMF-3/runs/<UTC date>-DATA-01.json.
# needs: 31
set -uo pipefail
python3 testing/fixtures/generate.py --check >/dev/null || { echo "[32] local fixtures differ from manifest"; exit 1; }
mkdir -p evidence/SMF-3/runs
python3 testing/provisioning/fixtures.py seed-twice --target-org smf-dev \
  --report "evidence/SMF-3/runs/$(date -u +%Y-%m-%d)-DATA-01.json"
case $? in 0) exit 0 ;; 2) echo "[32] DATA-01 checks did not all hold (see counts above)"; exit 2 ;; 3) echo "BLOCKED: seed preflight"; exit 2 ;; *) exit 1 ;; esac
