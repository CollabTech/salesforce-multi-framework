#!/usr/bin/env bash
# SMF-5 PKG-01: install v1 into the subscriber smf-install-test (never smf-dev or the Dev Hub).
# needs: 60
set -uo pipefail
python3 scripts/smf5/pkgflow.py install v1
