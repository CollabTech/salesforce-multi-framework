# PKG-03 — ENV-DESKTOP-CHROME — not run — app permission denial in the install-test org; sanitized package operation reports — not executed

| Field | Value |
|---|---|
| Case ID | PKG-03 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (remove/restore FieldSupport_Access); MF-RESTRICTED (denied) — logical IDs |
| Fixture IDs / hash / version | Persona baseline grants in the install-test org — not provisioned |
| Build / commit | Branch claude/smf-5-packaging @ 64bc02a |
| Host / device / OS / app / browser | None executed |
| Environment row | ENV-DESKTOP-CHROME — not run |
| Timestamp | 2026-10-03T22:07:51Z |
| Preconditions | v1 installed and PKG-01 baseline in smf-install-test. Actual: PKG-01 BLOCKED. |
| Steps | 1. docs/smf-5/subscriber-runbook.md step 9 (remove, restore) 2. docs/test-scripts/SMF-5-PKG.md § PKG-03 3. scripts/smf5/sanitize_report.py for every package operation report (runbook steps 4, 6, 10, 11) |
| Expected result | Repeat the app permission-denial scenario in the install-test org. Capture package operation reports and limitations without auth material. |
| Actual result | Not executed (no org, no package operations, so no reports exist). Offline only: sanitize_report.py unit-tested to replace package/request/user/org IDs, usernames, e-mails, Salesforce URLs and token-like fields while keeping status, version numbers, coverage and error text; scan-public-content.py now flags 0Ho/04t/05i/08c/0Hf/06y IDs. Limitations are listed in the runbook. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-5/subscriber-runbook.md; docs/test-scripts/SMF-5-PKG.md; scripts/smf5/sanitize_report.py |
| Tester | Implementing agent — offline checks only |
| Limitation / follow-up | Unblock: PKG-01 unblocking actions; then MF-ADMIN removes FieldSupport_Access from MF-RESTRICTED (runbook step 9) and Brandon, as MF-RESTRICTED in Chrome, runs § PKG-03 steps 2-4; admin restores and reruns SMF-3 check_baseline.py. MF-RESTRICTED is never dropped. |
