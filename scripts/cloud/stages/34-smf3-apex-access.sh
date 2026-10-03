#!/usr/bin/env bash
# SMF-3 DATA-02 (org level): deploy and run MF_AccessBaselineTest (System.runAs per persona,
# WITH USER_MODE). Sanitized summary -> evidence/SMF-3/runs/<UTC date>-DATA-02-apex.json.
# Does not prove UI/mobile login (stage 51 and testing/HUMAN-ACTIONS.md cover hosts).
# needs: 32
set -uo pipefail
mkdir -p evidence/SMF-3/runs
python3 testing/provisioning/access_tests.py --target-org smf-dev \
  --report "evidence/SMF-3/runs/$(date -u +%Y-%m-%d)-DATA-02-apex.json"
case $? in 0) exit 0 ;; 2) echo "[34] access test failures (see lines above)"; exit 2 ;; *) exit 1 ;; esac
