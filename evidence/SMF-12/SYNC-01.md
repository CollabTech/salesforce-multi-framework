# SYNC-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) — converge + presence; propagation <= 2 s — required rows

| Field | Value |
|---|---|
| Case ID | SYNC-01 |
| Story | SMF-12 |
| Persona pair | MF-TECH + MF-SUPPORT |
| Fixture IDs / hash / version | MF-ROOM-001, MF-MARKUP-001, MF-IMAGE-001 |
| Build / commit | 94e8f02 (claude/smf-12-sync) |
| Host / device / OS / app / browser | not executed — no org, no hosted sync service, no devices |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) |
| Timestamp | 2026-10-03T23:30:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. No hosted sync service: Cloudflare egress blocked and no CF_API_TOKEN/CF_ACCOUNT_ID (H4); owner secret steps S1/S2 not done. SMF-3/4/10/11 not verified in any org. No physical devices. |
| Steps | docs/test-scripts/SMF-12-SYNC.md SYNC-01; desktop rows automated by testing/cloud-e2e/tests/smf-12-sync.spec.ts (stage 72) once unblocked |
| Expected result | Independently create the circle and arrow/text; both sessions converge and show presence. Measure propagation delay; initial PoC target is <=2 seconds on a recorded stable network. |
| Actual result | Not executed in any required row. |
| Outcome | BLOCKED |
| Evidence link | docs/poc-briefs/SMF-12.md; docs/adr/0003-markup-live-sync.md |
| Tester | Implementing agent — recorded blocker only |
| Limitation / follow-up | Smallest unblocking action: owner H1 (incl. api.cloudflare.com, *.workers.dev) + H2 + H4 + H5, then S1 (wrangler secret SMF12_ROOM_TOKEN_SECRET) and S2 (MintKey on External Credential principal SMF12Mint); agent runs scripts/cloud/pipeline.sh 20 30 40 46 48 49 72 for ENV-DESKTOP-EDGE (+ ENV-CLOUD-CHROMIUM separately). Mobile rows: device tester runs docs/test-scripts/SMF-12-SYNC.md SYNC-01 1-4 (desktop TECH with iPhone SUPPORT; with Android SUPPORT). Apex test SMF12_RoomTokenServiceTest written, not run (no org). |
