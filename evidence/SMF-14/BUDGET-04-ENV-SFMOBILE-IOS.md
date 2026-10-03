# BUDGET-04 — ENV-SFMOBILE-IOS — maximum tested scene budget and fallback trigger

| Field | Value |
|---|---|
| Case ID | BUDGET-04 |
| Story | SMF-14 |
| Persona pair | n/a (derived from BUDGET-01..03 results) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | branch claude/smf-14-budget (see PR head) — not deployed |
| Host / device / OS / app / browser | physical iPhone in the Salesforce mobile app — no device available |
| Environment row | ENV-SFMOBILE-IOS |
| Timestamp | 2026-10-03T23:10:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore no deployed app (SMF-4), no personas or cases (SMF-3), no SMF-10 Apex deployed, no model Files (stage 47). BUDGET-04 additionally needs BUDGET-01..03 device results. |
| Steps | docs/test-scripts/SMF-14-BUDGET.md 14 |
| Expected result | Publish the maximum tested scene budget and fallback trigger from the results; do not claim a larger untested operating range. |
| Actual result | Not executed: prerequisite missing. No host, persona, device or org result exists for this row. No scene budget is published: none can be until hardware-rendered device measurements exist on a required row. Only the proposed measurement protocol (harness: 5 open/close + 60 s scripted protocol per model) and the proposed fallback-trigger rule (docs/poc-briefs/SMF-14.md, src/probes/smf-14-budget/budget.ts) are published. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-14-BUDGET.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the block only |
| Limitation / follow-up | Smallest unblocking action: After H1/H2 + stages 20/30/40/46/47: device tester runs docs/test-scripts/SMF-14-BUDGET.md on a physical iPhone in the Salesforce app (HUMAN-ACTIONS G5, G6, G8). |
