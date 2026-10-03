#!/usr/bin/env bash
# SMF-3 DATA-03 (+ org-level DATA-02 record access): compare profiles, roles, permission sets,
# group membership, OWD, share rows and UserRecordAccess with testing/provisioning/baseline.json.
# Sanitized report -> evidence/SMF-3/runs/<UTC date>-DATA-03-baseline.md. Read-only.
# needs: 32
T="${SMF_TARGET_ORG:-smf-dev}"   # SMF-5 reuses these stages for smf-install-test
set -uo pipefail
mkdir -p evidence/SMF-3/runs
python3 testing/provisioning/baseline.py --target-org "$T" \
  --report "evidence/SMF-3/runs/$(date -u +%Y-%m-%d)-DATA-03-baseline-$T.md"
case $? in 0) exit 0 ;; 2) echo "[33] baseline deviations (see table)"; exit 2 ;; 3) echo "BLOCKED: personas/fixtures missing"; exit 2 ;; *) exit 1 ;; esac
