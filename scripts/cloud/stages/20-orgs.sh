#!/usr/bin/env bash
# SMF-2 ENV-03: create the dev and install-test scratch orgs if absent, then save the vault.
# needs: 10
set -uo pipefail
sf org display --target-org smf-devhub --json >/dev/null 2>&1 || { echo "BLOCKED: no Dev Hub"; exit 2; }
# Dev Hub + unlocked packaging (irreversible): only with the owner's recorded consent (HUMAN-SETUP H3)
if ! sf data query --query "SELECT Id FROM ScratchOrgInfo LIMIT 1" --target-org smf-devhub --json >/dev/null 2>&1; then
  [ "${SMF_DEVHUB_ENABLE_OK:-}" = yes ] || { echo "BLOCKED: Dev Hub disabled and SMF_DEVHUB_ENABLE_OK!=yes (HUMAN-SETUP H3)"; exit 2; }
  echo "Dev Hub disabled: enable with .agents/skills/dx-org-devhub-configure (consent recorded)"; exit 2
fi
for alias in smf-dev smf-install-test; do
  if sf org display --target-org "$alias" --json >/dev/null 2>&1; then echo "OK  $alias exists"; continue; fi
  sf org create scratch --definition-file "config/$alias-scratch-def.json" --alias "$alias" \
     --target-dev-hub smf-devhub --duration-days 30 --wait 30 --json >/dev/null 2>&1 \
     && echo "OK  $alias created" || { echo "BLOCKED: $alias creation failed (capacity? see readiness report)"; exit 2; }
done
if [ "${SMF_VAULT_APPROVED:-}" = yes ]; then python3 scripts/cloud/vault.py save
else echo "NOTE: vault not approved (HUMAN-SETUP H7); org sessions last only for this container"; fi
