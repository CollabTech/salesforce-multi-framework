#!/usr/bin/env bash
# SMF-5 PKG-01: create the unlocked package FieldSupportPoC if absent (smf-devhub), then a
# validated v1 version built from HEAD. IDs -> private/packages.json; sanitized reports ->
# evidence/SMF-5/reports/. Runbook: docs/smf-5/subscriber-runbook.md.
# needs: 10 20
set -uo pipefail
python3 scripts/smf5/check_package.py || exit 1
python3 scripts/smf5/pkgflow.py version v1
