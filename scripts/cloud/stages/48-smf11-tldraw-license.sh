#!/usr/bin/env bash
# SMF-11/12: tldraw needs a license key in production (HTTPS, non-loopback host, production
# build = the app inside Salesforce). The owner sets TLDRAW_LICENSE_KEY in the environment (H5);
# this stage rebuilds the UI bundle with it exposed to Vite as VITE_TLDRAW_LICENSE_KEY and
# redeploys only the bundle. The key value is never printed or written to the repo.
# needs: 40
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
if [ -z "${TLDRAW_LICENSE_KEY:-}" ]; then
  echo "BLOCKED: TLDRAW_LICENSE_KEY is not set (owner step H5). Without it tldraw stops rendering in Salesforce after ~5 s; MARK-*/SYNC-* host rows stay BLOCKED."
  exit 2
fi
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev not authenticated (stage 20)"; exit 2; }
B=force-app/main/default/uiBundles/FieldSupport; mkdir -p private
( cd "$B" && npm ci --no-audit --no-fund >/dev/null 2>&1 \
  && VITE_TLDRAW_LICENSE_KEY="$TLDRAW_LICENSE_KEY" VITE_BUILD_COMMIT="$(git rev-parse --short HEAD)" npm run build >/dev/null ) \
  || { echo "bundle build with license key failed"; exit 1; }
grep -rqF "$TLDRAW_LICENSE_KEY" "$B/dist/assets" || { echo "license key not found in the built bundle"; exit 1; }
sf project deploy start --source-dir "$B" --target-org smf-dev --wait 30 --json > private/smf11-bundle-deploy.json 2>&1 \
  || { echo "bundle redeploy failed (details in private/smf11-bundle-deploy.json)"; exit 1; }
echo "bundle rebuilt with a tldraw license key (value not shown) and redeployed to smf-dev"
