# GOV-02 — fresh agent session — SMF-2 planning dry run

| Field | Value |
|---|---|
| Case ID | GOV-02 |
| Story | SMF-1 |
| Persona pair | Implementing agent (fresh, isolated session) |
| Fixture IDs / hash / version | n/a |
| Build / commit | `cb21b8c` |
| Host / device / OS / app / browser | Linux cloud container; Claude Code 2.1.288 headless |
| Environment row | n/a — repository/agent check |
| Timestamp | 2026-10-03T18:42:48Z |
| Preconditions | Same isolation as GOV-01; tools limited to Read/Glob/Grep/Skill (no shell, no writes, no web); no Jira or org access |
| Steps | Give the fresh agent only "assigned SMF-2, follow the repository's own instructions, dry run" and the requested output headings (prompt verbatim in the dry-run record). Compare its plan to the GOV-02 expectations. |
| Expected result | "Dry-run SMF-2 planning and verify selected skills, explicit target-org requirement, persona/fixture references, evidence template, and stop conditions are present." Additionally: "a fresh agent following only AGENTS.md can locate SMF-2's ENV-01–ENV-03 tests and SMF-3's shared test contract." |
| Actual result | Agent read CLAUDE.md → AGENTS.md → SMF-2/SMF-3 snapshot → `testing/test-plan-index.json` → `testing/contract.json` → `evidence/TEMPLATE.md`. It quoted ENV-01, ENV-02, ENV-03 verbatim and located SMF-3's contract in both forms. **Skills:** 4 project + 6 official, each SKILL.md opened, with reasons for exclusions. **Target org:** `--target-org <alias>` on every org command, identity check before writes, Dev Hub ≠ test org, plus skill-derived cautions (no `--verbose` / `sf org open --json` leaks). **Personas/fixtures:** MF-ADMIN only acts; TECH/SUPPORT/RESTRICTED sized for capacity; fixtures not provisioned. **Evidence plan:** all template fields per case. **Stop conditions:** 8, including SMF-1 not yet accepted. It changed nothing (`git status` clean in the clone). |
| Outcome | PASS |
| Evidence link | `docs/dry-runs/SMF-2-plan.md` |
| Tester | Implementing agent ran and checked it. Review: Brandon (pending) |
| Limitation / follow-up | The agent's §8 gaps were fixed here where they were SMF-1's (dry-runs folder, private-mapping format) or logged (C-01, C-05). Glob did not list `.claude/skills` symlinks; discovery itself is proven by GOV-01. The plan used the Jira snapshot (no Jira access); SMF-2 must re-read live Jira. |
