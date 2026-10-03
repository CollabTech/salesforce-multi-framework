# ADR-0001: Project-scoped official and project skills, one instruction file

- **Status:** Proposed — revision 2 (2026-10-03): decision changed from option 1 to option 2 after SMF-1 review
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-1 (GOV-01, GOV-02, GOV-03)
- **Deciders:** Project owner (review); implementing agent (proposal)

> **Superseded in part:** the Decision and Consequences sections below describe revision 1
> (vendor copies committed, `install-official-skills.sh`, `--write-hashes`). Revision 2 at the
> end of this ADR replaces them.

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

## Revision 2 (2026-10-03) — install on demand

**Why:** the SMF-1 review resolved C-02 (upstream `LICENSE.txt` Apache-2.0 vs `package.json`
CC-BY-NC-4.0) by not redistributing vendor copies, and found two portability defects in
option 1: whole-tree byte hashes broke under CRLF checkouts, and tracked symlinks became
text placeholders on Windows without `core.symlinks`.

**Decision:** option 2. Official skill folders and all `.claude/skills` entries are
git-ignored. `python3 scripts/bootstrap-skills.py` installs the 28 pinned skills with the
upstream-documented `npx skills@1.7.0 add …/tree/<revision>/skills/<name> --agent codex`,
then creates `.claude/skills/<name>` for every skill (relative symlink → Windows junction →
copy). `docs/provenance/official-skills.json` records the upstream Git blob ID of every
file at the pinned revision; `scripts/verify-skills.py` checks each installed file against
it (CRLF/LF tolerant; any other change, extra or missing file fails) and checks each
`.claude/skills` entry exposes the canonical, readable `SKILL.md`.

**Consequences:** a fresh clone needs one bootstrap command (Python 3.8+, Node/npx,
network to github.com and registry.npmjs.org) before skills are discoverable; this is the
first step in `README.md` and `AGENTS.md`. Installed content is still reviewable because
it is pinned and verified against upstream blob IDs. Earlier commits on the SMF-1 branch
still contain vendor copies; merge PR #1 with **squash** so `main` never carries them.
`scripts/install-official-skills.sh` is removed.

**History:** commits before revision 2 on the SMF-1 branch contain the vendor folders.
Squash-merge PR #1 and delete the branch afterwards; GitHub still retains PR refs
(`refs/pull/1/*`), which only GitHub support can purge. The upstream `LICENSE.txt`
(Apache-2.0) permits that redistribution; the conflicting `package.json` metadata is the
residual risk, recorded in C-02 for the owner.

**Verification:** `.github/workflows/repo-checks.yml` runs bootstrap, all checks and two
negative checks on Linux, macOS, Windows (symlink) and Windows with `SMF_FORCE_JUNCTION=1`
(directory-junction fallback) on every push.
