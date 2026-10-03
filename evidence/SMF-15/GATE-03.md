# GATE-03 — n/a — packaging, licensing, prerequisites and access-control findings

| Field | Value |
|---|---|
| Case ID | GATE-03 |
| Story | SMF-15 |
| Persona pair | n/a — no Salesforce persona; decision-maker Brandon (not yet involved), evidence presented by the implementing agent |
| Fixture IDs / hash / version | All SMF-3 fixtures as referenced by SMF-4..14 records (contract 1.0.0); no new accounts |
| Build / commit | claude/smf-15-review at d6ead3d (integrates SMF-1..14 branches) |
| Host / device / OS / app / browser | n/a — repository review in the Linux cloud container (Python 3.11, Node v22) |
| Environment row | n/a |
| Timestamp | 2026-10-03T23:45:00Z |
| Preconditions | Integrated tree on claude/smf-15-review. |
| Steps | 1. python3 scripts/smf5/check_package.py --built (sf CLI, offline): package = app shell only 2. Collected licences, service prerequisites, costs and access-control findings from the SMF-5..14 briefs, ADRs and contradictions: docs/smf-15/REVIEW-PACKAGE.md §6 |
| Expected result | Confirm packaging, licensing, service prerequisites, and access-control findings before allowing SMF-16 to start. |
| Actual result | Package contents verified offline (UIBundle FieldSupport, CustomApplication FieldSupport, PermissionSet FieldSupport_Access; ADR-0005). Licences and prerequisites documented (H1–H9; tldraw production key; Cloudflare plan; RealtimeKit $0.002 per participant-minute). Access findings A1–A8 listed. Not confirmed in any org: PKG-01..03 BLOCKED; no Apex test or deny path has run. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-15/REVIEW-PACKAGE.md §6; docs/adr/0005-package-composition-probe-backends.md; docs/contradictions.md |
| Tester | Implementing agent (Claude Code cloud session). Not reviewed by Brandon or any person yet. |
| Limitation / follow-up | Smallest unblocking action: H1+H2 (+H4, H5, H8), then stages 20–72 and 60–64; then Brandon accepts or schedules findings A1–A4 and the open contradictions. SMF-16 must not start before this. |
