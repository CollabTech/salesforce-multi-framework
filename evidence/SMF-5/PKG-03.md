# PKG-03 — ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM separate row) — not run — app permission denial in the install-test org; sanitized package operation reports — not executed

| Field | Value |
|---|---|
| Case ID | PKG-03 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (remove/restore FieldSupport_Access); MF-RESTRICTED (denied, own session) — logical IDs |
| Fixture IDs / hash / version | Persona baseline grants in the install-test org — not provisioned |
| Build / commit | Branch claude/smf-5-packaging @ b43b29f |
| Host / device / OS / app / browser | None executed |
| Environment row | ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM separate row) — not run |
| Timestamp | 2026-10-03T22:35:00Z |
| Preconditions | v1 installed and baseline in smf-install-test. Actual: PKG-01 BLOCKED. |
| Steps | 1. bash scripts/cloud/pipeline.sh 63 (spec PKG-03: remove FieldSupport_Access from MF-RESTRICTED in smf-install-test, open the installed app as MF-RESTRICTED, assert not rendered and record the page text, restore, assert renders) 2. Sanitized reports written by stages 60/61/64 to evidence/SMF-5/reports/ via scripts/smf5/sanitize_report.py |
| Expected result | Repeat the app permission-denial scenario in the install-test org. Capture package operation reports and limitations without auth material. |
| Actual result | Not executed (no org, so no package operations or reports exist). Offline only: sanitize_report.py unit-tested (IDs, usernames, e-mails, Salesforce URLs, token-like fields removed; status, version numbers, coverage and error text kept); scan-public-content.py flags 0Ho/04t/05i/08c/0Hf/06y IDs; limitations listed in the runbook. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-5/subscriber-runbook.md; testing/cloud-e2e/tests/smf-5-package.spec.ts; scripts/smf5/sanitize_report.py |
| Tester | Implementing agent — offline checks only |
| Limitation / follow-up | Unblock: PKG-01 unblocking actions, then stage 63. The spec checks direct-URL denial; App Launcher listing while removed is checked only in the human script. MF-RESTRICTED is never dropped. |
