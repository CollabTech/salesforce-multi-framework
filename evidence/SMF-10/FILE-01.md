# FILE-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) — upload, record link, fresh-session read as SUPPORT — required rows

| Field | Value |
|---|---|
| Case ID | FILE-01 |
| Story | SMF-10 |
| Persona pair | MF-TECH uploads; MF-SUPPORT reads |
| Fixture IDs / hash / version | MF-CASE-001, MF-IMAGE-001 (SMF-3 assets not on this branch; hash to be taken from the SMF-3 manifest) |
| Build / commit | 022583c (claude/smf-10-files) |
| Host / device / OS / app / browser | not executed — no org, no hosted app, no devices |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) |
| Timestamp | 2026-10-03T22:15:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. SMF-3 personas/fixtures and SMF-4 deployed app not verified in any org. |
| Steps | docs/test-scripts/SMF-10-FILES.md FILE-01 1-7 (desktop rows automated by testing/cloud-e2e/tests/smf-10-files.spec.ts via stage 52 once unblocked) |
| Expected result | Upload the valid image, verify its correct record link, then read it as SUPPORT from a fresh session. |
| Actual result | Not executed in any required row. |
| Outcome | BLOCKED |
| Evidence link | docs/poc-briefs/SMF-10.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded blocker only |
| Limitation / follow-up | Smallest unblocking action: owner completes docs/cloud/HUMAN-SETUP.md H1 (Salesforce egress) and H2 (SF_AUTH_URL_DEVHUB); then the agent runs scripts/cloud/pipeline.sh 20 30 40 46 52 (SMF-3 provisioning incl. private/fixtures.json, deploy, SMF10_Access + Apex tests, persona spec) for ENV-DESKTOP-EDGE (+ ENV-CLOUD-CHROMIUM as a separate row; ENV-DESKTOP-CHROME needs dl.google.com in H1). Physical rows: device tester runs docs/test-scripts/SMF-10-FILES.md FILE-01 1-7 on an iPhone and an Android phone in the Salesforce app (HUMAN-ACTIONS rows in the SMF-10 handoff). Apex tests (SMF10_*Test) written but not run: no org. |
