#!/usr/bin/env bash
# SMF-3 DATA-03 prerequisite: deploy the sharing baseline (Account/Case/Asset Private) and the
# MF_Case_Worker permission set to smf-dev (metadata-format deploy; no sfdx-project.json needed),
# then verify fields/required fields/OWD with the fixture preflight.
# needs: 20
set -uo pipefail
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev not authenticated (stage 20 / vault)"; exit 2; }
out=$(sf project deploy start --metadata-dir testing/provisioning/metadata --wait 30 --target-org smf-dev --json 2>/dev/null)
rc=$?
python3 - "$out" <<'PY'
import json, sys
try:
    r = json.loads(sys.argv[1] or "{}")
except json.JSONDecodeError:
    r = {}
res = r.get("result") or {}
print(f"[30] deploy status={res.get('status', r.get('name', '?'))} components={res.get('numberComponentsDeployed', '?')}/{res.get('numberComponentsTotal', '?')}")
for f in ((res.get("details") or {}).get("componentFailures") or []):
    f = f if isinstance(f, dict) else {}
    print(f"[30] FAILED {f.get('componentType')} {f.get('fullName')}: {f.get('problem')}")
PY
[ $rc -eq 0 ] || { echo "[30] metadata deploy failed"; exit 1; }
python3 testing/provisioning/fixtures.py preflight --target-org smf-dev
case $? in 0) exit 0 ;; 2|3) echo "BLOCKED: preflight problems above (DATA-03)"; exit 2 ;; *) exit 1 ;; esac
