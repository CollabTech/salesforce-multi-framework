# GATE-02 — n/a — supported devices, capabilities and fallbacks

| Field | Value |
|---|---|
| Case ID | GATE-02 |
| Story | SMF-15 |
| Persona pair | n/a — no Salesforce persona; decision-maker Brandon (not yet involved), evidence presented by the implementing agent |
| Fixture IDs / hash / version | All SMF-3 fixtures as referenced by SMF-4..14 records (contract 1.0.0); no new accounts |
| Build / commit | claude/smf-15-review at d6ead3d (integrates SMF-1..14 branches) |
| Host / device / OS / app / browser | n/a — repository review in the Linux cloud container (Python 3.11, Node v22) |
| Environment row | n/a |
| Timestamp | 2026-10-03T23:45:00Z |
| Preconditions | GATE-01 report available; no required-row evidence exists. |
| Steps | 1. Drafted the decision table (include-if criteria per case ID, named fallback per capability, proposed device set): docs/smf-15/REVIEW-PACKAGE.md §5 |
| Expected result | Choose supported devices/capabilities and named fallbacks; record exclusions and any explicit reduced-scope decision. |
| Actual result | No capability can be chosen as supported: no required row has an executed outcome. A proposal with explicit inclusion criteria and named fallbacks is ready for the owner. No reduced-scope decision exists or is assumed. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-15/REVIEW-PACKAGE.md §5 |
| Tester | Implementing agent (Claude Code cloud session). Not reviewed by Brandon or any person yet. |
| Limitation / follow-up | Smallest unblocking action: device and host evidence (GATE-01), then Brandon decides on each row of §5 and records any reduced scope in Jira SMF-15 before SMF-16. |
