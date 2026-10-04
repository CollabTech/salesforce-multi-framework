#!/usr/bin/env bash
# SMF-3 AC1: licence check first, then create/reconcile MF-TECH, MF-SUPPORT, MF-RESTRICTED with
# `sf org create user` (FederationIdentifier = logical persona ID; CLI aliases smf-dev-tech,
# smf-dev-support, smf-dev-restricted), assign MF_Case_Worker (+ FieldSupport_Access once SMF-4
# deployed it), persona sessions are recovered in later containers by scripts/cloud/orgs.py personas (JWT).
# Persona e-mail: $SMF_TESTER_EMAIL when set (HUMAN-SETUP H6), else example.com.
# needs: 30
T="${SMF_TARGET_ORG:-smf-dev}"   # SMF-5 reuses these stages for smf-install-test
set -uo pipefail
# recover aliases of personas that already exist in the org (new container), so reconcile finds them
python3 scripts/cloud/orgs.py personas "$T" || true
python3 testing/provisioning/personas.py --target-org "$T" --reconcile
rc=$?
case $rc in
  0) ;;
  3) echo "BLOCKED: persona provisioning (licences/profile/permission set; reason above)"; exit 2 ;;
  2) echo "BLOCKED: persona deviations remain (see DEVIATION lines; a missing alias: run scripts/cloud/orgs.py personas with JWT Dev Hub auth)"; exit 2 ;;
  *) exit 1 ;;
esac
for a in "$T-tech" "$T-support" "$T-restricted"; do
  sf org display --target-org "$a" --json >/dev/null 2>&1 || { echo "BLOCKED: persona alias $a missing"; exit 2; }
done
