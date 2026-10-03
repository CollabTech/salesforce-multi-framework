# GATE-01 — n/a — matrix rows checked against evidence

| Field | Value |
|---|---|
| Case ID | GATE-01 |
| Story | SMF-15 |
| Persona pair | n/a — no Salesforce persona; decision-maker Brandon (not yet involved), evidence presented by the implementing agent |
| Fixture IDs / hash / version | All SMF-3 fixtures as referenced by SMF-4..14 records (contract 1.0.0); no new accounts |
| Build / commit | claude/smf-15-review at d6ead3d (integrates SMF-1..14 branches) |
| Host / device / OS / app / browser | n/a — repository review in the Linux cloud container (Python 3.11, Node v22) |
| Environment row | n/a |
| Timestamp | 2026-10-03T23:45:00Z |
| Preconditions | Matrix synced from every evidence record (scripts/build-matrix.py --sync; --check OK). |
| Steps | 1. python3 scripts/gate-check.py --write (checks every row: evidence exists with persona/build/host/timestamp/tester; no localhost, emulation, mock, simulation or Chromium behind a required row; physical-mobile rows name the Salesforce app; human rows have a human tester; no admin-session substitution) 2. Negative tests: python3 -m unittest scripts/tests/test_gate_check.py (12 cases, each rejection rule triggered) |
| Expected result | Check every planned capability/environment row against actual evidence, persona, fixture, build, and tester; reject unsupported PASS claims. |
| Actual result | 328 rows checked; 0 rejected claims. Only SMF-1 is VALIDATED (3/3 n/a rows PASS). 169 required rows are BLOCKED or NOT TESTED across SMF-2..16; every executed PASS/FAIL/PARTIAL outside SMF-1 is a supplementary localhost row. Report: testing/gate/GATE-01-report.md. |
| Outcome | BLOCKED |
| Evidence link | testing/gate/GATE-01-report.md; testing/gate/GATE-01-report.json; docs/smf-15/REVIEW-PACKAGE.md §1–§4 |
| Tester | Implementing agent (Claude Code cloud session). Not reviewed by Brandon or any person yet. |
| Limitation / follow-up | The automated check is complete and runs in CI. The gate cannot complete while required rows have no executed evidence. Smallest unblocking action: HUMAN-SETUP H1+H2, then the cloud pipeline; then the device rows in testing/HUMAN-ACTIONS.md; then Brandon reviews the regenerated report. |
