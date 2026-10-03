# SYNC-03 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) — restricted / wrong-case denial; revocation timing — required rows

| Field | Value |
|---|---|
| Case ID | SYNC-03 |
| Story | SMF-12 |
| Persona pair | MF-RESTRICTED; MF-TECH (wrong case); MF-SUPPORT (revocation) |
| Fixture IDs / hash / version | MF-ROOM-001, MF-ROOM-002 / MF-CASE-002 |
| Build / commit | 94e8f02 (claude/smf-12-sync) |
| Host / device / OS / app / browser | not executed — no org, no hosted sync service, no devices |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (all required rows) |
| Timestamp | 2026-10-03T23:30:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. No hosted sync service: Cloudflare egress blocked and no CF_API_TOKEN/CF_ACCOUNT_ID (H4); owner secret steps S1/S2 not done. SMF-3/4/10/11 not verified in any org. No physical devices. |
| Steps | docs/test-scripts/SMF-12-SYNC.md SYNC-03; desktop rows automated by testing/cloud-e2e/tests/smf-12-sync.spec.ts (stage 72) once unblocked |
| Expected result | Deny restricted/wrong-case room and asset access; test revoked access and document the actual enforcement timing. |
| Actual result | Not executed in any required row. |
| Outcome | BLOCKED |
| Evidence link | docs/poc-briefs/SMF-12.md; docs/adr/0003-markup-live-sync.md |
| Tester | Implementing agent — recorded blocker only |
| Limitation / follow-up | Smallest unblocking action: owner H1 (incl. api.cloudflare.com, *.workers.dev) + H2 + H4 + H5, then S1 (wrangler secret SMF12_ROOM_TOKEN_SECRET) and S2 (MintKey on External Credential principal SMF12Mint); agent runs scripts/cloud/pipeline.sh 20 30 40 46 48 49 72 for ENV-DESKTOP-EDGE (+ ENV-CLOUD-CHROMIUM separately). Mobile rows: SMF-12-SYNC.md SYNC-03 1-3. Apex test SMF12_RoomTokenServiceTest written, not run (no org). |
