#!/usr/bin/env bash
# Re-establish org auth in a fresh cloud container (ADR-0004). Never prints secrets.
#   SF_AUTH_URL_DEVHUB (required, human-provided once): SFDX auth URL of the Dev Hub.
# Restores smf-dev, smf-install-test and persona aliases (smf-dev-tech|support|restricted)
# from the encrypted vault File in the Dev Hub (scripts/cloud/vault.py).
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"; mkdir -p private; chmod 700 private
export SF_DISABLE_TELEMETRY=true
log(){ printf '[smf-orgs] %s\n' "$*" >&2; }
printf '%s' "$SF_AUTH_URL_DEVHUB" | sf org login sfdx-url --sfdx-url-stdin - --alias smf-devhub --json >/dev/null 2>&1 \
  && log "OK  smf-devhub" \
  || { log "BLOCKED smf-devhub: auth URL rejected, or login.salesforce.com/*.my.salesforce.com not allowed by the environment network policy"; exit 1; }
python3 scripts/cloud/vault.py restore
sf alias list --json 2>/dev/null | python3 -c "import json,sys;d={r['alias']:r['value'] for r in json.load(sys.stdin).get('result',[]) if r['alias'].startswith('smf-')};json.dump(d,open('private/orgs.json','w'),indent=2);print('[smf-orgs] aliases:', ', '.join(sorted(d)), file=sys.stderr)"
