# GOV-02 — fresh agent session — SMF-2 planning dry run

> Historical record (before the PR #1 review). Current result: `GOV-02-run3.md`.

| Field | Value |
|---|---|
| Case ID | GOV-02 |
| Story | SMF-1 |
| Persona pair | Implementing agent (fresh, isolated session) |
| Fixture IDs / hash / version | n/a |
| Build / commit | Run 2: `8ccdef8`. Run 1: `cb21b8c` |
| Host / device / OS / app / browser | Linux cloud container; Claude Code 2.1.288 headless |
| Environment row | n/a — repository/agent check |
| Timestamp | Run 2: 2026-10-03T20:53:23Z–20:54:30Z. Run 1: 2026-10-03T18:42:48Z |
| Preconditions | Same isolation as GOV-01; tools limited to Read/Glob/Grep/Skill, Bash/Write/Edit/Web denied; no Jira or org access |
| Steps | Give the fresh agent only "assigned SMF-2, follow the repository's own instructions, dry run" and the requested output headings (prompt verbatim in the dry-run record; run 2 adds item 9 on persona/fixture existence, ownership and delegation). Compare its plan to the expected result. Confirm `git status` is clean in the clone afterwards. |
| Expected result | "Dry-run SMF-2 planning and verify selected skills, explicit target-org requirement, persona/fixture references, evidence template, and stop conditions are present." Additionally: "a fresh agent following only AGENTS.md can locate SMF-2's ENV-01–ENV-03 tests and SMF-3's shared test contract." |
| Actual result | Run 2: the agent read CLAUDE.md → AGENTS.md → test-plan index → contract.json → SMF-2 → SMF-1 (dependency) → SMF-3 → evidence template → contradictions. **Tests/contract:** quoted ENV-01, ENV-02, ENV-03 verbatim; located SMF-3's contract in the snapshot and `testing/contract.json` incl. `fixture_provisioning_ownership`. **Skills:** 4 project + 6 official, each SKILL.md opened; exclusions justified. **Target org:** `--target-org <alias>` on every org command, identity check before writes, Dev Hub ≠ test org, overrides for skill defaults that fall back to a default org; no `--verbose` / `sf org open --json`. **Personas/fixtures:** MF-ADMIN acts; TECH/SUPPORT/RESTRICTED only sized for licences; a shortage is BLOCKED, never dropping the negative-test persona. **Evidence plan:** every template field for each case. **Stop conditions:** 7, incl. SMF-1 not yet accepted. **Standing rule (item 9):** marked every persona/fixture "unverified / specification only", named the owning story for each (SMF-3, SMF-7, SMF-11/12, SMF-13/14), and said delegated work must name story/case IDs, personas, fixtures, expected outcome and sanitized evidence, which it would re-verify. Clone `git status` clean. Run 1 had the same result for the original 8 items. |
| Outcome | PASS |
| Evidence link | `docs/dry-runs/SMF-2-plan.md` (run 2 verbatim; run 1 in Git history) |
| Tester | Implementing agent ran and checked it. Review: Brandon (pending) |
| Limitation / follow-up | Run 2 §8.5 found that official `dx-*` skills auto-write raw org JSON into `force-app/main/adk-eval-output/`; fixed in this PR (`.gitignore`, `smf-salesforce-boundaries`). Other §8 items (Edge meaning, UIBundle API version, Hyperforce/domain checks, second org availability) belong to SMF-2 (ENV-01/03; C-05). The plan used the snapshot; live Jira was confirmed identical to it on 2026-10-03 (see GOV-03). |
