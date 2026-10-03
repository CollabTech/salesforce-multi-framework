#!/usr/bin/env bash
# SMF-5 PKG-02: snapshot the seeded state, create v2 (HEAD + set_version.py v2), upgrade
# smf-install-test v1 -> v2, re-snapshot and compare (admin + each persona's own session),
# then verify the v2 marker in cloud browsers as the personas.
# needs: 62 63
set -uo pipefail
python3 scripts/smf5/pkgflow.py state before-v2 || exit $?
python3 scripts/smf5/pkgflow.py version v2 || exit $?
python3 scripts/smf5/pkgflow.py install v2 || exit $?
python3 scripts/smf5/pkgflow.py state after-v2 || exit $?
python3 scripts/smf5/pkgflow.py verify-state before-v2 after-v2 || exit $?
cd testing/cloud-e2e || exit 1
npm install --no-audit --no-fund >/dev/null 2>&1
if command -v xvfb-run >/dev/null; then
  SMF_PKG_EXPECT=v2 SMF_HEADED=1 xvfb-run -a npx playwright test tests/smf-5-package.spec.ts --grep "PKG-02"
else
  SMF_PKG_EXPECT=v2 npx playwright test tests/smf-5-package.spec.ts --grep "PKG-02"
fi
