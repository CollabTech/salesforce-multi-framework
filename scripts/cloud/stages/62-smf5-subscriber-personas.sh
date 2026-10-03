#!/usr/bin/env bash
# SMF-5: independently seed the SMF-3 baseline in smf-install-test by running SMF-3's own
# provisioning stages (30-39) with SMF_TARGET_ORG=smf-install-test. Contract expected from
# SMF-3 (C-SMF5-6): persona users created there with CLI aliases
# smf-install-test-{tech,support,restricted} (FederationIdentifier MF-*), fixtures seeded,
# record IDs under the "install-test" key of private/fixtures.json, vault saved. Then
# assign FieldSupport_Access (installed by the package) to the three personas.
# needs: 61
set -uo pipefail
stages=$(ls scripts/cloud/stages/3[0-9]-*.sh 2>/dev/null | sort)
[ -n "$stages" ] || { echo "BLOCKED: SMF-3 provisioning stages (30-39) not present on this branch"; exit 2; }
for s in $stages; do
  echo "-- $(basename "$s") with SMF_TARGET_ORG=smf-install-test"
  SMF_TARGET_ORG=smf-install-test bash "$s"; rc=$?
  [ $rc -eq 0 ] || { echo "BLOCKED: $(basename "$s") returned $rc for smf-install-test"; exit 2; }
done
python3 scripts/smf5/pkgflow.py access
