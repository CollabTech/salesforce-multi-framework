# BUDGET-03 — ENV-DESKTOP-EDGE — authorized delivery and RESTRICTED denial

| Field | Value |
|---|---|
| Case ID | BUDGET-03 |
| Story | SMF-14 |
| Persona pair | MF-TECH + MF-RESTRICTED |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | branch claude/smf-14-budget (see PR head) — not deployed |
| Host / device / OS / app / browser | Microsoft Edge (Linux, cloud) via scripts/cloud/stages/57-smf14-budget.sh — not run |
| Environment row | ENV-DESKTOP-EDGE |
| Timestamp | 2026-10-03T23:10:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore no deployed app (SMF-4), no personas or cases (SMF-3), no SMF-10 Apex deployed, no model Files (stage 47). |
| Steps | docs/test-scripts/SMF-14-BUDGET.md 10-13 (desktop: testing/cloud-e2e/tests/smf-14-budget.spec.ts via stage 57) |
| Expected result | Verify authorized delivery of model and textures and denial for RESTRICTED if Files is used; report any asset path that bypasses access checks. |
| Actual result | Not executed: prerequisite missing. No host, persona, device or org result exists for this row. Localhost results are recorded separately and are not evidence for this row. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-14-BUDGET.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the block only |
| Limitation / follow-up | Smallest unblocking action: Owner H1 + H2, then stages 20, 30, 40, 46, 47, 57 run this row automatically as MF-TECH and MF-RESTRICTED. |
