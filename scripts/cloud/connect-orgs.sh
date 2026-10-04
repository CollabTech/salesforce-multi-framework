#!/usr/bin/env bash
# Re-establish org sessions in a fresh cloud container without the ADR-0004 vault (disabled).
# Dev Hub from environment secrets (JWT trio preferred, or SF_AUTH_URL_DEVHUB), then recovery of
# existing scratch orgs and persona users found server-side through the Dev Hub
# (scripts/cloud/orgs.py). Never creates orgs here and never prints secrets.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"; mkdir -p private; chmod 700 private
export SF_DISABLE_TELEMETRY=true
python3 scripts/cloud/orgs.py devhub || exit $?
for role in smf-dev smf-install-test; do
  python3 scripts/cloud/orgs.py ensure "$role" && python3 scripts/cloud/orgs.py personas "$role" || true
done
sf alias list --json 2>/dev/null | python3 -c "import json,sys;d={r['alias']:r['value'] for r in json.load(sys.stdin).get('result',[]) if r['alias'].startswith('smf-')};json.dump(d,open('private/orgs.json','w'),indent=2);print('[smf-orgs] aliases:', ', '.join(sorted(d)), file=sys.stderr)"
