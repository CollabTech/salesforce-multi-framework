#!/usr/bin/env bash
# SMF-10/11 probe server-side metadata (NOT packaged: lives in probes/, stage 40 deploys force-app only).
# Deploys the SMF10_*/SMF11_* Apex classes and permission sets from probes/main/default to smf-dev,
# assigns the story permission sets to MF-TECH, MF-SUPPORT and MF-RESTRICTED alike (denials must
# come from sharing, not Apex class access), then runs the stories' Apex tests.
# needs: 30 40
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
P=probes/main/default
mapfile -t SOURCES < <(ls "$P"/classes/SMF1[01]_*.cls "$P"/permissionsets/SMF1[01]_Access.permissionset-meta.xml 2>/dev/null)
PERMSETS=$(ls "$P"/permissionsets/SMF1[01]_Access.permissionset-meta.xml 2>/dev/null | xargs -n1 basename | sed 's/.permissionset-meta.xml//')
TESTS=$(ls "$P"/classes/SMF1[01]_*Test.cls 2>/dev/null | xargs -n1 basename | sed 's/.cls$//')
[ -n "$PERMSETS" ] || { echo "BLOCKED: no SMF10/11 probe metadata under $P in this checkout"; exit 2; }
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev not authenticated (stage 20)"; exit 2; }
mkdir -p private
args=(); for s in "${SOURCES[@]}"; do args+=(--source-dir "$s"); done
sf project deploy start "${args[@]}" --target-org smf-dev --wait 30 --json > private/smf10-11-probe-deploy.json 2>&1 \
  || { echo "probe metadata deploy failed (details in private/smf10-11-probe-deploy.json)"; exit 1; }
echo "deployed SMF-10/11 probe metadata (${#SOURCES[@]} sources) to smf-dev"
for p in tech support restricted; do
  u=$(sf org display user --target-org "smf-dev-$p" --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])') \
    || { echo "BLOCKED: persona alias smf-dev-$p missing (stage 30)"; exit 2; }
  for ps in $PERMSETS; do
    out=$(sf org assign permset --name "$ps" --on-behalf-of "$u" --target-org smf-dev --json 2>&1)
    if ! grep -q '"status": 0' <<<"$out" && ! grep -qi 'duplicate' <<<"$out"; then echo "assign $ps to MF-${p^^} failed"; exit 1; fi
    echo "assigned $ps to MF-${p^^}"
  done
done
targs=(); for t in $TESTS; do targs+=(--class-names "$t"); done
sf apex run test "${targs[@]}" --target-org smf-dev --code-coverage --wait 30 --json > private/smf10-11-apex-tests.json 2>&1
python3 - <<'EOF'
import json, sys
r = json.load(open("private/smf10-11-apex-tests.json")).get("result", {})
s = r.get("summary", {})
print(f"Apex tests: outcome={s.get('outcome')} passing={s.get('passing')} failing={s.get('failing')} coverage={s.get('testRunCoverage')}")
for t in r.get("tests", []):
    if t.get("Outcome") != "Pass":
        print(f"  FAIL {t.get('ApexClass', {}).get('Name')}.{t.get('MethodName')}: {(t.get('Message') or '')[:200]}")
sys.exit(0 if s.get("outcome") == "Passed" else 1)
EOF
