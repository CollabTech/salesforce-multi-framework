#!/usr/bin/env bash
# Cloud pipeline: runs scripts/cloud/stages/NN-*.sh in order (each story owns its own stage
# files, so parallel story branches never edit a shared pipeline file).
#   bash scripts/cloud/pipeline.sh all            # every stage
#   bash scripts/cloud/pipeline.sh 30 40          # only stages whose number is listed
#   bash scripts/cloud/pipeline.sh list
# Every stage targets an explicit alias (smf-devhub, smf-dev, smf-install-test, persona
# aliases) and writes sanitized results only. A stage exits 0 (done), 2 (BLOCKED: printed
# reason), or other (failure). The pipeline continues past BLOCKED stages whose dependants
# are not affected and stops on failure.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
export PATH="/opt/sfcli/node_modules/.bin:$PATH" SF_DISABLE_TELEMETRY=true
stages=$(ls scripts/cloud/stages/[0-9][0-9]-*.sh 2>/dev/null | sort)
[ "${1:-}" = list ] && { for s in $stages; do echo "$(basename "$s")"; done; exit 0; }
want=" ${*:-all} "
declare -A blocked=()
for s in $stages; do
  n=$(basename "$s" | cut -c1-2)
  [[ "$want" == *" all "* || "$want" == *" $n "* ]] || continue
  needs=$(sed -n 's/^# needs: *//p' "$s")
  skip=""; for d in $needs; do [ -n "${blocked[$d]:-}" ] && skip="$d"; done
  if [ -n "$skip" ]; then echo "== $(basename "$s"): BLOCKED (depends on blocked stage $skip)"; blocked[$n]=1; continue; fi
  echo "== $(basename "$s")"
  bash "$s"; rc=$?
  case $rc in 0) ;; 2) blocked[$n]=1 ;; *) echo "== $(basename "$s") FAILED ($rc)"; exit $rc ;; esac
done
