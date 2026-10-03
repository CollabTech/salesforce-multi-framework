# ADR-0001: Project-scoped official and project skills, one instruction file

- **Status:** Proposed (accept with SMF-1 review)
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-1 (GOV-01, GOV-02, GOV-03)
- **Deciders:** Project owner (review); implementing agent (proposal)

## Context
SMF-1 AC2 requires the applicable official Salesforce skills at project scope via their
supported mechanism, with upstream source and revision recorded, discoverable by the chosen
coding agent, and without silent reliance on machine-global installs.

Salesforce publishes its skills in `forcedotcom/afv-library` (README alias
`forcedotcom/sf-skills`), following the open Agent Skills spec. The README's documented
install for Claude Code / Codex / Cursor is `npx skills add forcedotcom/sf-skills`; the npm
package `@salesforce/afv-skills` is the Agentforce Vibes channel.

## Options considered
1. **Commit `npx skills add` output, pinned by revision** — works offline in any fresh
   clone; reviewable diff on upgrade; ~5.6 MB.
2. Install on demand (git-ignored) — smaller repo, but a fresh session cannot discover
   skills until someone runs the installer, and the installed content is not reviewable.
3. Global install (`-g`) — rejected by AC2.
4. Install all 241 upstream skills — mostly unrelated clouds (Commerce, ITSM, Life
   Sciences…); noisier skill selection with no benefit.

## Decision
Option 1 with a curated subset of 28 skills (list and reasons in
`docs/provenance/official-skills.md`), installed by `scripts/install-official-skills.sh`
from `forcedotcom/afv-library` at commit `3c15867b…` (release 1.59.0) for agents
`claude-code` and `codex`. Canonical copies live in `.agents/skills/`; Claude Code reads
symlinks in `.claude/skills/`. `skills-lock.json` (written by the skills CLI) records
source + ref; `docs/provenance/official-skills.json` records a content hash per skill that
`scripts/verify-skills.py` enforces.

Project rules live in one root `AGENTS.md` (read natively by Codex, Cursor and others);
`CLAUDE.md` imports it for Claude Code. Project skills are `smf-*` folders beside the
official ones and are never written into upstream skill folders.

## Consequences
- Upgrades are deliberate: bump `REVISION`, rerun the installer, `verify-skills.py
  --write-hashes`, review the diff, and update provenance.
- Upstream warns skills may be renamed/removed between releases; AGENTS.md says only names
  present in `.agents/skills/` exist.
- Licence metadata disagreement upstream is recorded in `docs/contradictions.md` (C-02).
