#!/usr/bin/env bash
# SMF-2 ENV-01/02/03: read-only readiness of the three targets.
# needs:
sf org display --target-org smf-devhub --json >/dev/null 2>&1 || { echo "BLOCKED: smf-devhub not authenticated (HUMAN-SETUP H1/H2)"; exit 2; }
d=$(date -u +%F)
python3 scripts/sf/readiness.py --devhub smf-devhub --dev smf-dev --install-test smf-install-test --report "evidence/SMF-2/readiness-$d.md"
exit 0   # findings are recorded in the report; stage 20 creates missing targets
