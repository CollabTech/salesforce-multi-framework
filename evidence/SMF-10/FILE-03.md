# FILE-03 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) — invalid types/sizes, cancel/failure/retry, no duplicates — required rows

| Field | Value |
|---|---|
| Case ID | FILE-03 |
| Story | SMF-10 |
| Persona pair | MF-TECH |
| Fixture IDs / hash / version | MF-UPLOAD-INVALID (.txt, >5 MiB image), MF-IMAGE-001, MF-CASE-001 |
| Build / commit | 022583c (claude/smf-10-files) |
| Host / device / OS / app / browser | not executed — no org, no hosted app, no devices |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) |
| Timestamp | 2026-10-03T22:15:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. SMF-3 personas/fixtures and SMF-4 deployed app not verified in any org. |
| Steps | docs/test-scripts/SMF-10-FILES.md FILE-03 1-5 (desktop rows automated by testing/cloud-e2e/tests/smf-10-files.spec.ts via stage 70 once unblocked) |
| Expected result | Reject .txt and >5 MiB images cleanly, test cancel/failure/retry, and confirm retries do not create unintended duplicate attachments. |
| Actual result | Not executed in any required row. |
| Outcome | BLOCKED |
| Evidence link | docs/poc-briefs/SMF-10.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded blocker only |
| Limitation / follow-up | Smallest unblocking action: owner completes docs/cloud/HUMAN-SETUP.md H1 (Salesforce egress) and H2 (SF_AUTH_URL_DEVHUB); then the agent runs scripts/cloud/pipeline.sh 20 30 40 46 70 (SMF-3 provisioning incl. private/fixtures.json, deploy, SMF10_Access + Apex tests, persona spec) for ENV-DESKTOP-EDGE (+ ENV-CLOUD-CHROMIUM as a separate row; ENV-DESKTOP-CHROME needs dl.google.com in H1). Physical rows: device tester runs docs/test-scripts/SMF-10-FILES.md FILE-03 1-5 on an iPhone and an Android phone in the Salesforce app (HUMAN-ACTIONS rows in the SMF-10 handoff). Apex tests (SMF10_*Test) written but not run: no org. |
