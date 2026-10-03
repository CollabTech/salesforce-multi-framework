# MARK-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) — circle, arrow, label by mouse and touch; pan/zoom — required rows

| Field | Value |
|---|---|
| Case ID | MARK-01 |
| Story | SMF-11 |
| Persona pair | MF-TECH (circle); MF-SUPPORT (arrow + text) |
| Fixture IDs / hash / version | MF-IMAGE-001, MF-MARKUP-001 |
| Build / commit | 8d33958 (claude/smf-11-markup) |
| Host / device / OS / app / browser | not executed — no org, no hosted app, no devices |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) |
| Timestamp | 2026-10-03T22:37:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. SMF-3 personas/fixtures, SMF-4 app and SMF-10 Files not verified in any org. No tldraw production license key (owner H5). |
| Steps | docs/test-scripts/SMF-11-MARKUP.md MARK-01; desktop rows automated by testing/cloud-e2e/tests/smf-11-markup.spec.ts (stage 71) once unblocked |
| Expected result | Use mouse and mobile touch to create the prescribed circle, arrow, and label; verify pan/zoom and readable annotation positioning. |
| Actual result | Not executed in any required row. |
| Outcome | BLOCKED |
| Evidence link | docs/poc-briefs/SMF-11.md |
| Tester | Implementing agent — recorded blocker only |
| Limitation / follow-up | Smallest unblocking action: owner H1 + H2 (+ H5 TLDRAW_LICENSE_KEY covering the Salesforce host); then the agent runs scripts/cloud/pipeline.sh 20 30 40 46 48 70 71 for ENV-DESKTOP-EDGE (+ ENV-CLOUD-CHROMIUM as a separate row). Touch rows: device tester runs docs/test-scripts/SMF-11-MARKUP.md MARK-01 1-6 on iPhone and Android in the Salesforce app. Apex tests SMF11_*Test written, not run (no org). |
