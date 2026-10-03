#!/usr/bin/env bash
# SMF-12: deploy the markup sync service to Cloudflare Workers (wrangler; Durable Object with
# SQLite storage per the tldraw sync-cloudflare template) and the SMF-12 probe metadata (not
# packaged; probes/main/default) to smf-dev with the real Worker URL.
#
# Secrets are NEVER written by this script. Owner step (named in docs/poc-briefs/SMF-12.md):
#   S1 Cloudflare: `npx wrangler secret put SMF12_ROOM_TOKEN_SECRET` in services/markup-sync
#      (≥32 random characters), or Dashboard > Workers > smf-markup-sync > Settings > Variables and Secrets.
#   S2 Salesforce (smf-dev): Setup > Named Credentials > External Credentials > SMF12_MarkupSync >
#      Principals > SMF12Mint > Authentication Parameters: add MintKey = the SAME value.
# The stage reports BLOCKED (exit 2) when CF credentials are missing (H4), when the Worker
# reports secretConfigured=false (S1), or when a persona's token request is refused by the
# Worker (S2 missing or different from S1).
# needs: 30 40 46
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
P=probes/main/default
mkdir -p private
[ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ACCOUNT_ID:-}" ] || { echo "BLOCKED: CF_API_TOKEN / CF_ACCOUNT_ID not set (owner step H4)"; exit 2; }
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev not authenticated (stage 20)"; exit 2; }

# 1. Build, test and deploy the Worker.
( cd services/markup-sync && npm ci --no-audit --no-fund >/dev/null 2>&1 && npx tsc -p tsconfig.worker.json && npm test >/dev/null ) \
  || { echo "markup-sync build/tests failed"; exit 1; }
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" WRANGLER_SEND_METRICS=false
( cd services/markup-sync && npx wrangler deploy ) > private/smf12-wrangler-deploy.log 2>&1 \
  || { echo "wrangler deploy failed (private/smf12-wrangler-deploy.log)"; exit 1; }
URL=$(grep -oE 'https://smf-markup-sync\.[a-z0-9.-]+\.workers\.dev' private/smf12-wrangler-deploy.log | head -1)
[ -n "$URL" ] || { echo "could not read the Worker URL from wrangler output"; exit 1; }
echo "$URL" > private/smf12-worker-url.txt   # account subdomain: kept private
echo "Worker deployed (URL in private/smf12-worker-url.txt)"

# 2. Secret present on the Worker? (only the boolean is read)
configured=$(curl -fsS "$URL/health" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("secretConfigured"))' 2>/dev/null)
if [ "$configured" != "True" ]; then
  echo "BLOCKED: SMF12_ROOM_TOKEN_SECRET is not set on the Worker (owner step S1: wrangler secret put SMF12_ROOM_TOKEN_SECRET)"
  exit 2
fi

# 3. Salesforce probe metadata with the real URL (temporary in-place substitution, restored on exit).
FILES=("$P/namedCredentials/SMF12_MarkupSync.namedCredential-meta.xml" "$P/cspTrustedSites/SMF12_Markup_Sync_Service.cspTrustedSite-meta.xml")
trap 'git checkout -- "${FILES[@]}" 2>/dev/null' EXIT
for f in "${FILES[@]}"; do sed -i "s#https://smf-markup-sync.invalid#$URL#" "$f"; done
sf project deploy start \
  --source-dir "$P/externalCredentials/SMF12_MarkupSync.externalCredential-meta.xml" \
  --source-dir "${FILES[0]}" --source-dir "${FILES[1]}" \
  $(for c in "$P"/classes/SMF12_*.cls; do printf -- '--source-dir %s ' "$c"; done) \
  --source-dir "$P/permissionsets/SMF12_Access.permissionset-meta.xml" \
  --target-org smf-dev --wait 30 --json > private/smf12-probe-deploy.json 2>&1 \
  || { echo "SMF-12 probe metadata deploy failed (private/smf12-probe-deploy.json)"; exit 1; }
echo "deployed SMF-12 probe metadata to smf-dev"

# 4. Persona grants + Apex tests.
for p in tech support restricted; do
  u=$(sf org display user --target-org "smf-dev-$p" --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])') \
    || { echo "BLOCKED: persona alias smf-dev-$p missing (stage 30)"; exit 2; }
  out=$(sf org assign permset --name SMF12_Access --on-behalf-of "$u" --target-org smf-dev --json 2>&1)
  grep -q '"status": 0' <<<"$out" || grep -qi duplicate <<<"$out" || { echo "assign SMF12_Access to MF-${p^^} failed"; exit 1; }
done
sf apex run test --class-names SMF12_RoomTokenServiceTest --target-org smf-dev --wait 30 --json > private/smf12-apex-tests.json 2>&1
python3 -c 'import json,sys;s=json.load(open("private/smf12-apex-tests.json")).get("result",{}).get("summary",{});print("Apex tests:",s.get("outcome"),s.get("passing"),"passing",s.get("failing"),"failing");sys.exit(0 if s.get("outcome")=="Passed" else 1)' || exit 1

# 5. End-to-end token check as MF-TECH (detects owner step S2).
CASE=$(python3 -c 'import json;m=json.load(open("private/fixtures.json"));v=m.get("MF-CASE-001");print(v if isinstance(v,str) else (v or {}).get("dev",""))' 2>/dev/null)
[ -n "$CASE" ] || { echo "BLOCKED: MF-CASE-001 not in private/fixtures.json (stage 30)"; exit 2; }
status=$(sf api request rest "/services/apexrest/smf12/v1/cases/$CASE/room-token" --method POST --target-org smf-dev-tech 2>/dev/null \
  | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); print("ok" if d.get("token") else d.get("message",""))
except Exception: print("unreadable")')
case "$status" in
  ok) echo "MF-TECH obtained a room token (value not shown)";;
  *refused*401*) echo "BLOCKED: Worker refused the mint key — owner step S2 (MintKey on External Credential principal SMF12Mint) missing or different from S1"; exit 2;;
  *) echo "token check failed: $status"; exit 1;;
esac
