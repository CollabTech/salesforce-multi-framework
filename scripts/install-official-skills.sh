#!/usr/bin/env bash
# Installs the project-scoped official Salesforce skills at a pinned upstream revision.
# Uses the upstream-documented mechanism (`npx skills add`, see the afv-library README)
# and writes only inside this repository: .agents/skills/ (canonical copy, read by
# Codex and other Agent Skills tools) and .claude/skills/ (symlinks, read by Claude Code).
# Provenance and the reason each skill was selected: docs/provenance/official-skills.md
set -euo pipefail

SOURCE_REPO="https://github.com/forcedotcom/afv-library"
REVISION="3c15867bdb9dacd515960174c661c706d041bb63"   # afv-library release 1.59.0
SKILLS_CLI="skills@1.7.0"
AGENTS="claude-code codex"

SKILLS=(
  experience-ui-bundle-app-coordinate
  experience-ui-bundle-project-generate
  experience-ui-bundle-metadata-generate
  experience-ui-bundle-frontend-generate
  experience-ui-bundle-salesforce-data-access
  experience-ui-bundle-file-upload-generate
  experience-ui-bundle-custom-app-generate
  experience-ui-bundle-deploy
  experience-ui-bundle-2gp-deploy
  dx-org-devhub-configure
  dx-org-manage
  dx-org-switch
  dx-org-analyze
  dx-org-permission-set-assign
  dx-org-trial-expiration-check
  platform-permission-set-generate
  platform-sharing-owd-configure
  platform-sharing-rules-generate
  platform-data-manage
  platform-soql-query
  platform-metadata-deploy
  platform-metadata-retrieve
  platform-docs-get
  platform-apex-generate
  platform-apex-test-generate
  platform-apex-test-run
  dx-code-analyzer-run
  design-systems-slds-apply
)

cd "$(git rev-parse --show-toplevel)"
for skill in "${SKILLS[@]}"; do
  echo "==> $skill @ ${REVISION:0:12}"
  # shellcheck disable=SC2086
  npx -y "$SKILLS_CLI" add "$SOURCE_REPO/tree/$REVISION/skills/$skill" --agent $AGENTS -y >/dev/null
done
echo "Installed ${#SKILLS[@]} skills. Run: python3 scripts/verify-skills.py"
