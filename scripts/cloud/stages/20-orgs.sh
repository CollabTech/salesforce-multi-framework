#!/usr/bin/env bash
# SMF-2 ENV-03: verify the Dev Hub, then recover or create the dev and install-test scratch orgs.
# Existing orgs are found through the Dev Hub (ScratchOrgInfo), never inferred from a missing
# local alias, so a new container never creates a duplicate (scripts/cloud/orgs.py).
# needs: 10
set -uo pipefail
python3 scripts/cloud/orgs.py devhub; rc=$?
if [ $rc -ne 0 ]; then
  [ $rc -eq 2 ] && [ "${SMF_DEVHUB_ENABLE_OK:-}" != yes ] && echo "BLOCKED: Dev Hub unavailable or disabled (HUMAN-SETUP H2/H3)"
  exit 2
fi
for role in smf-dev smf-install-test; do
  python3 scripts/cloud/orgs.py ensure "$role" --create || { echo "BLOCKED: $role (reason above)"; exit 2; }
done
echo "NOTE: ADR-0004 vault disabled; cross-session recovery uses JWT Dev Hub auth (ADR-0004 rev 2)"
