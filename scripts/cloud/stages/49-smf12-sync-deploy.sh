#!/usr/bin/env bash
# SMF-12: deploy the markup sync service (Cloudflare Worker, Durable Object + SQLite) restricted to
# the OBSERVED Salesforce app origin, configure the room-token secret on both sides, deploy the
# SMF-12 probe metadata (not packaged; probes/main/default), and verify the whole chain before any
# live-sync test (stage 72 needs 49):
#   1. build + unit tests of the service
#   2. observe the app origin as MF-TECH in the real host (testing/cloud-e2e smf-12-origin.spec.ts)
#   3. wrangler deploy --var SMF12_ALLOWED_ORIGINS:<observed origin>  (empty allowlist = deny all)
#   4. generate a fresh signing secret in memory; `wrangler secret put` (stdin) on the Worker and
#      the same value into External Credential SMF12_MarkupSync / SMF12Mint / MintKey through the
#      Connect REST credential API (scripts/cloud/sf_credential.py, stdin). Never printed or stored.
#   5. /health: secret configured, exactly the allowlist, allow-any off
#   6. probe metadata with the real Worker URL, SMF12_Access for the personas, Apex tests
#   7. MF-TECH obtains a room token through Apex (proves the mint key matches)
#   8. Origin enforcement with that real token: allowed origin 101, other origin 403, none 403
# Exit 0 verified, 2 BLOCKED (reason), 1 failure (stage 72 must not run).
# needs: 30 40 46
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
P=probes/main/default
mkdir -p private; chmod 700 private
[ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ACCOUNT_ID:-}" ] || { echo "BLOCKED: CF_API_TOKEN / CF_ACCOUNT_ID not set (HUMAN-SETUP H4)"; exit 2; }
for a in smf-dev smf-dev-tech; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: $a not authenticated (stages 20/31)"; exit 2; }
done

# 1. Build and test the service.
( cd services/markup-sync && npm ci --no-audit --no-fund >/dev/null 2>&1 && npx tsc -p tsconfig.worker.json && npm test >/dev/null ) \
  || { echo "markup-sync build/tests failed"; exit 1; }

# 2. Observe the origin the probe actually runs on (never assumed).
rm -f private/smf12-app-origin.json
proj=ENV-DESKTOP-EDGE; command -v microsoft-edge >/dev/null 2>&1 || proj=ENV-CLOUD-CHROMIUM
( cd testing/cloud-e2e && npx playwright test tests/smf-12-origin.spec.ts --project "$proj" --reporter=line ) >private/smf12-origin-spec.log 2>&1
ORIGIN=$(python3 -c 'import json;print(json.load(open("private/smf12-app-origin.json"))["appOrigin"])' 2>/dev/null)
case "$ORIGIN" in
  https://*) echo "observed app origin as MF-TECH ($proj); framed=$(python3 -c 'import json;print(json.load(open("private/smf12-app-origin.json"))["framed"])')" ;;
  *) echo "BLOCKED: could not observe the app origin (private/smf12-origin-spec.log); not deploying an open allowlist"; exit 2 ;;
esac

# 3. Deploy the Worker restricted to that origin.
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" WRANGLER_SEND_METRICS=false
( cd services/markup-sync && npx wrangler deploy --var "SMF12_ALLOWED_ORIGINS:$ORIGIN" ) > private/smf12-wrangler-deploy.log 2>&1 \
  || { echo "wrangler deploy failed (private/smf12-wrangler-deploy.log)"; exit 1; }
URL=$(grep -oE 'https://smf-markup-sync\.[a-z0-9.-]+\.workers\.dev' private/smf12-wrangler-deploy.log | head -1)
[ -n "$URL" ] || { echo "could not read the Worker URL from wrangler output"; exit 1; }
echo "$URL" > private/smf12-worker-url.txt   # account subdomain: kept private
echo "Worker deployed with a one-origin allowlist (URL in private/)"

# 4. Fresh signing secret, set on both sides; exists only in this process.
SECRET=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')
printf '%s' "$SECRET" | ( cd services/markup-sync && npx wrangler secret put SMF12_ROOM_TOKEN_SECRET ) >/dev/null 2>&1 \
  || { unset SECRET; echo "wrangler secret put failed"; exit 1; }

# 5. Worker configuration as seen from outside (booleans and counts only).
health=$(curl -fsS "$URL/health" 2>/dev/null)
python3 - "$health" <<'PY' || { unset SECRET; exit 1; }
import json, sys
h = json.loads(sys.argv[1] or "{}")
ok = h.get("secretConfigured") is True and h.get("allowedOriginCount") == 1 and h.get("allowAnyOrigin") is False
print(f"Worker health: secretConfigured={h.get('secretConfigured')} allowedOriginCount={h.get('allowedOriginCount')} allowAnyOrigin={h.get('allowAnyOrigin')}")
sys.exit(0 if ok else 1)
PY

# 6. Probe metadata with the real URL (temporary substitution, restored on exit), then the mint key.
FILES=("$P/namedCredentials/SMF12_MarkupSync.namedCredential-meta.xml" "$P/cspTrustedSites/SMF12_Markup_Sync_Service.cspTrustedSite-meta.xml")
trap 'git checkout -- "${FILES[@]}" 2>/dev/null' EXIT
for f in "${FILES[@]}"; do sed -i "s#https://smf-markup-sync.invalid#$URL#" "$f"; done
sf project deploy start \
  --source-dir "$P/externalCredentials/SMF12_MarkupSync.externalCredential-meta.xml" \
  --source-dir "${FILES[0]}" --source-dir "${FILES[1]}" \
  $(for c in "$P"/classes/SMF12_*.cls; do printf -- '--source-dir %s ' "$c"; done) \
  --source-dir "$P/permissionsets/SMF12_Access.permissionset-meta.xml" \
  --target-org smf-dev --wait 30 --json > private/smf12-probe-deploy.json 2>&1 \
  || { unset SECRET; echo "SMF-12 probe metadata deploy failed (private/smf12-probe-deploy.json)"; exit 1; }
printf '%s' "$SECRET" | python3 scripts/cloud/sf_credential.py --target-org smf-dev \
  --external-credential SMF12_MarkupSync --principal SMF12Mint --parameter MintKey --from-stdin \
  || { unset SECRET; exit 2; }
unset SECRET

for p in tech support restricted; do
  u=$(sf org display user --target-org "smf-dev-$p" --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])') \
    || { echo "BLOCKED: persona alias smf-dev-$p missing (stage 31)"; exit 2; }
  out=$(sf org assign permset --name SMF12_Access --on-behalf-of "$u" --target-org smf-dev --json 2>&1)
  grep -q '"status": 0' <<<"$out" || grep -qi duplicate <<<"$out" || { echo "assign SMF12_Access to MF-${p^^} failed"; exit 1; }
done
sf apex run test --class-names SMF12_RoomTokenServiceTest --target-org smf-dev --wait 30 --json > private/smf12-apex-tests.json 2>&1
python3 -c 'import json,sys;s=json.load(open("private/smf12-apex-tests.json")).get("result",{}).get("summary",{});print("Apex tests:",s.get("outcome"),s.get("passing"),"passing",s.get("failing"),"failing");sys.exit(0 if s.get("outcome")=="Passed" else 1)' || exit 1

# 7. Real room token as MF-TECH through Apex (fixtures.json: {org: {records: {key: [ids]}}}).
CASE=$(python3 -c 'import json;print(json.load(open("private/fixtures.json"))["smf-dev"]["records"]["MF-CASE-001"][0])' 2>/dev/null)
[ -n "$CASE" ] || { echo "BLOCKED: MF-CASE-001 not in private/fixtures.json (stage 32)"; exit 2; }
sf api request rest "/services/apexrest/smf12/v1/cases/$CASE/room-token" --method POST --target-org smf-dev-tech --json \
  > private/smf12-token.json 2>/dev/null; chmod 600 private/smf12-token.json
code=$(python3 -c 'import json;print(json.load(open("private/smf12-token.json"))["result"]["statusCode"])' 2>/dev/null)
case "$code" in
  200) echo "MF-TECH obtained a room token through Apex (value not shown)";;
  *) echo "token request as MF-TECH returned HTTP ${code:-none} (mint key mismatch shows as 503 from Apex)"; rm -f private/smf12-token.json; exit 1;;
esac

# 8. Origin enforcement with that real token.
export SMF12_ALLOWED_ORIGIN="$ORIGIN"
eval "$(python3 - <<'PY'
import json, shlex
b = json.load(open("private/smf12-token.json"))["result"]["body"]
for k, v in (("SMF12_WS_URL", b["wsUrl"]), ("SMF12_ROOM", b["room"]), ("SMF12_TOKEN", b["token"])):
    print(f"export {k}={shlex.quote(v)}")
PY
)"
rm -f private/smf12-token.json
check=$(cd services/markup-sync && node test/origin-check.mjs); rc=$?
unset SMF12_TOKEN
echo "$check" > private/smf12-origin-check.json
echo "origin enforcement: $check"
[ $rc -eq 0 ] || { echo "FAIL: Worker origin allowlist not enforced as required; stage 72 must not run"; exit 1; }
echo "OK  SMF-12 sync service verified for the observed Salesforce origin"
