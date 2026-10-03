#!/usr/bin/env bash
# SMF-7 deploy: RealtimeKit app/preset (Cloudflare API, env CF_ACCOUNT_ID/CF_API_TOKEN used
# in-process only), SMF7 metadata + generated config record to smf-dev, SMF7_Access for the
# personas, then a readiness check of the org-side secret WITHOUT reading or writing it.
# The Cloudflare token inside the org is an OWNER step (docs/smf-7/realtimekit-setup.md, O-SMF7-1);
# this stage never writes any secret anywhere. Exit 0 ready, 2 BLOCKED (reason), other = failure.
# needs: 30 40
set -uo pipefail
ORG=smf-dev
sf org display --target-org "$ORG" --json >/dev/null 2>&1 || { echo "BLOCKED: $ORG missing (stage 20)"; exit 2; }
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing (stage 30)"; exit 2; }
done

# 1. RealtimeKit app + preset; writes private/smf7-deploy (config record) and private/smf7/realtimekit.json
python3 scripts/cloud/smf7_realtimekit.py prepare || exit $?

# 2. SMF7 metadata (idempotent) and the generated, never-committed config record
D=force-app/main/default
args=()
for f in $D/objects/SMF7_Call_Room__c $D/objects/SMF7_Call_Participant__c $D/objects/SMF7_RealtimeKit_Config__mdt \
         $D/customPermissions/SMF7_Join_Call.customPermission-meta.xml \
         $D/externalCredentials/SMF7_Cloudflare.externalCredential-meta.xml $D/namedCredentials/SMF7_Cloudflare.namedCredential-meta.xml \
         $D/classes/SMF7_*.cls $D/cspTrustedSites/SMF7_*.cspTrustedSite-meta.xml $D/permissionsets/SMF7_Access.permissionset-meta.xml; do
  args+=(--source-dir "$f")
done
sf project deploy start --target-org "$ORG" --wait 30 --json "${args[@]}" >private/smf7/deploy.json 2>&1 \
  || { echo "FAILED: SMF7 metadata deploy (sanitize private/smf7/deploy.json before sharing)"; exit 1; }
(cd private/smf7-deploy && sf project deploy start --source-dir force-app --target-org "$ORG" --wait 10 --json >../smf7/config-deploy.json 2>&1) \
  || { echo "FAILED: config record deploy"; exit 1; }
echo "OK  SMF7 metadata and config record deployed to $ORG"

# 3. SMF7_Access for TECH, SUPPORT, RESTRICTED (denial must come from case access) and the setup admin (readiness check only)
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  u=$(sf org display user --target-org "$a" --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])')
  sf org assign permset --name SMF7_Access --on-behalf-of "$u" --target-org "$ORG" --json >/dev/null 2>&1 || true
done
sf org assign permset --name SMF7_Access --target-org "$ORG" --json >/dev/null 2>&1 || true
echo "OK  SMF7_Access assigned (MF-TECH, MF-SUPPORT, MF-RESTRICTED, setup admin)"

# 4. Owner step present? (status only; the secret is never read)
status=$(sf api request rest "/services/data/v67.0/named-credentials/external-credentials/SMF7_Cloudflare" --target-org "$ORG" 2>/dev/null \
  | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); print(",".join(p.get("authenticationStatus","?") for p in d.get("principals",[])) or "none")
except Exception: print("unknown")')
if [[ "$status" != *Configured* || "$status" == *NotConfigured* ]]; then
  echo "BLOCKED: External Credential SMF7_Cloudflare principal SMF7_Principal is not configured (status: $status)."
  echo "         Owner step O-SMF7-1 in docs/smf-7/realtimekit-setup.md: set authentication parameter ApiToken in Setup."
  exit 2
fi

# 5. End-to-end readiness through the Named Credential (prints a status word only)
tmp=$(mktemp --suffix=.apex)
echo "System.debug(LoggingLevel.ERROR, 'SMF7CHECK|' + SMF7_CallAuthService.checkConfiguration());" >"$tmp"
check=$(sf apex run --file "$tmp" --target-org "$ORG" --json 2>/dev/null | python3 -c 'import json,re,sys
log=json.load(sys.stdin).get("result",{}).get("logs","")
m=re.search(r"SMF7CHECK\|(\w+)",log); print(m.group(1) if m else "UNKNOWN")')
rm -f "$tmp"
case "$check" in
  OK) echo "OK  RealtimeKit reachable through SMF7_Cloudflare; preset present" ;;
  PROVIDER_ERROR_401|PROVIDER_ERROR_403) echo "BLOCKED: org-side Cloudflare token rejected ($check): redo owner step O-SMF7-1 with a token that has Realtime: Edit"; exit 2 ;;
  PROVIDER_ERROR_0) echo "BLOCKED: org cannot reach api.cloudflare.com ($check)"; exit 2 ;;
  *) echo "BLOCKED: readiness check returned $check"; exit 2 ;;
esac
