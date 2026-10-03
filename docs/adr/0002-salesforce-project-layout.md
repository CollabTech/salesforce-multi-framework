# ADR-0002: Where the official Salesforce app scaffold will be generated

- **Status:** Proposed — to be confirmed or amended by SMF-4 before generating
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-1 AC1 (documents location only); generation belongs to SMF-4
- **Deciders:** Project owner (review); implementing agent (proposal)

## Context
SMF-1 AC1 asks us to document where the official Salesforce app scaffold will be generated
later; no org or deployed app is required now. The direction is an internal React UIBundle
distributed as an unlocked 2GP.

The official skill `experience-ui-bundle-project-generate` (afv-library 1.59.0) generates
with `sf template generate project`, template `reactinternalapp` for internal,
employee-facing apps, and **flattens the output into the target root, overwriting files on
conflict** (including `README.md`). Its sibling `experience-ui-bundle-metadata-generate`
requires bundles under `force-app/main/default/uiBundles/<AppName>/`.

## Decision
- SFDX project root = **repository root** (`sfdx-project.json`, `package.json`,
  `config/`, `scripts/` beside the governance files), so `sf` commands, 2GP packaging, and
  the official skills' `uiBundles/*/src/` triggers work without path overrides.
- The UI bundle lives at `force-app/main/default/uiBundles/<AppName>/`, with `<AppName>`
  alphanumeric (skill requirement) and chosen in SMF-4.
- Because the generator overwrites on conflict, SMF-4 generates into a temporary directory
  and merges, preserving `AGENTS.md`, `CLAUDE.md`, `README.md`, `.gitignore` and
  `scripts/` contents (merge entries rather than replace).
- Package directories and the 2GP definition in `sfdx-project.json` are decided by SMF-5
  using `experience-ui-bundle-2gp-deploy`.

## Consequences
- No Salesforce scaffold exists in this repository until SMF-4.
- If SMF-2 finds the template or CLI unavailable for the chosen org/API version, SMF-4
  records a blocker and amends this ADR rather than hand-scaffolding.
