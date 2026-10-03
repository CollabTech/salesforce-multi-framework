#!/usr/bin/env bash
# SMF-3 DATA-04: add any missing matrix rows, copy outcomes from evidence records into their rows,
# validate (every case covered, valid outcomes, evidence links exist) and render testing/MATRIX.md.
# Never invents results: a row changes only through an evidence/SMF-n/<CASE>[-<ENV>].md record.
# needs:
set -uo pipefail
python3 scripts/build-matrix.py --sync
