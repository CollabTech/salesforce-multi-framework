#!/usr/bin/env bash
# SMF-3 AC1: licence check first, then create/reconcile MF-TECH, MF-SUPPORT, MF-RESTRICTED with
# `sf org create user` (FederationIdentifier = logical persona ID; CLI aliases smf-dev-tech,
# smf-dev-support, smf-dev-restricted), assign MF_Case_Worker (+ FieldSupport_Access once SMF-4
# deployed it), then save the persona sessions to the encrypted vault (ADR-0004).
# Persona e-mail: $SMF_TESTER_EMAIL when set (HUMAN-SETUP H6), else example.com.
# needs: 30
set -uo pipefail
python3 testing/provisioning/personas.py --target-org smf-dev --reconcile
rc=$?
case $rc in
  0) ;;
  3) echo "BLOCKED: persona provisioning (licences/profile/permission set; reason above)"; exit 2 ;;
  2) echo "BLOCKED: persona deviations remain (see DEVIATION lines; a missing alias means the vault was not restored)"; exit 2 ;;
  *) exit 1 ;;
esac
for a in smf-dev-tech smf-dev-support smf-dev-restricted; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing"; exit 2; }
done
if [ "${SMF_VAULT_APPROVED:-}" = yes ] && [ -n "${SF_AUTH_URL_DEVHUB:-}" ]; then   # ADR-0004 needs owner approval (HUMAN-SETUP H7)
  python3 scripts/cloud/vault.py save || { echo "[31] vault save failed (personas still usable this session)"; exit 1; }
else
  echo "[31] vault not saved (ADR-0004 not approved, HUMAN-SETUP H7): personas last only for this container"
fi
