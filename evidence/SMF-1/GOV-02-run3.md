# GOV-02 — n/a — repository/agent check — SMF-2 planning dry run after the review corrections (run 3)

| Field | Value |
|---|---|
| Case ID | GOV-02 |
| Story | SMF-1 |
| Persona pair | Implementing agent (fresh, isolated, read-only session) |
| Fixture IDs / hash / version | n/a |
| Build / commit | b79111a (official skills installed by bootstrap) |
| Host / device / OS / app / browser | Linux cloud container; Claude Code 2.1.288 headless |
| Environment row | n/a — repository/agent check |
| Timestamp | 2026-10-03T21:42:56Z–21:44:24Z |
| Preconditions | Empty HOME; --setting-sources project; Read/Glob/Grep/Skill only; no Jira or org |
| Steps | 1. Run-2 prompt plus: open skills via .claude/skills/<name>/SKILL.md; (10) what to run after cloning 2. Compare output to GOV-02 expectations; git status in the clone |
| Expected result | Dry-run SMF-2 planning and verify selected skills, explicit target-org requirement, persona/fixture references, evidence template, and stop conditions are present; a fresh agent following only AGENTS.md can locate SMF-2's ENV-01–ENV-03 tests and SMF-3's shared test contract. |
| Actual result | Located ENV-01..03 in the index and SMF-3 contract; selected the AGENTS.md §3 skills and opened each through .claude/skills/<name>/SKILL.md successfully; explicit --target-org rule and Dev Hub ≠ test org; personas/fixtures as specifications with owners; evidence-template plan per case; stop conditions; answered (10) with the bootstrap command and its prerequisites. Clone unchanged. |
| Outcome | PASS |
| Evidence link | docs/dry-runs/SMF-2-plan-run3.md |
| Tester | Implementing agent |
| Limitation / follow-up | The read-only agent could not run the bootstrap itself (Bash denied); it ran in a checkout where the bootstrap had already been run, which is the documented contributor state. |
