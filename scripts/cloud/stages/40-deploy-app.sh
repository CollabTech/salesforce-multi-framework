#!/usr/bin/env bash
# SMF-4: build, static checks, deploy the UI bundle + CustomApplication + FieldSupport_Access
# to smf-dev. App access is granted to personas by the SMF-3 stage, never to the admin.
# needs: 20
set -uo pipefail
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev missing (stage 20)"; exit 2; }
B=force-app/main/default/uiBundles/FieldSupport
( cd "$B" && npm install --no-audit --no-fund >/dev/null 2>&1 && npm run lint >/dev/null && npx vitest run >/dev/null \
  && VITE_BUILD_COMMIT=$(git rev-parse --short HEAD) npm run build >/dev/null ) || { echo "FAILED: bundle checks/build"; exit 1; }
sf project deploy start --source-dir force-app --target-org smf-dev --wait 30 --json > private/deploy-smf-dev.json 2>&1
python3 - <<'P'
import json,sys
d=json.load(open('private/deploy-smf-dev.json'))
ok=d.get('status')==0 and d.get('result',{}).get('success')
print(f"deploy smf-dev: {'OK' if ok else 'FAILED'}; components={d.get('result',{}).get('numberComponentsDeployed')}; errors={d.get('result',{}).get('numberComponentErrors')}")
sys.exit(0 if ok else 1)
P
