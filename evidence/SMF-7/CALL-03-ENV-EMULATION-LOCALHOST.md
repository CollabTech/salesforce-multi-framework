# CALL-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | CALL-03 |
| Story | SMF-7 |
| Persona pair | none (no Salesforce session) |
| Fixture IDs / hash / version | none; the Apex token endpoint was STUBBED with Playwright page.route |
| Build / commit | branch claude/smf-7-call working tree (unpublished build 'local'); @cloudflare/realtimekit 2.0.2 |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e served on http://localhost:5176; no egress to Cloudflare |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:27:27Z |
| Preconditions | Project fake-devices-granted (e2e/media/playwright.config.ts). /session/csrf and /services/apexrest/smf7/v1/call-token answered by stubs. |
| Steps | 1. Stub returns 403 NO_CASE_ACCESS; enter a case id; Request room; watch requests to *.realtime.cloudflare.com for 2 s 2. Stub returns 200 with a fake, well-formed JWT; Request room; wait for the outcome and 10 s more; count token-endpoint calls and RealtimeKit requests; search the DOM for the token 3. Click 'Join with an invalid token' with the token endpoint set to abort; read the outcome 4. Open the probe; check the test phrase and that Join is disabled without a case |
| Expected result | Localhost-scoped statement (written before running): a 403 from the endpoint shows NO_CASE_ACCESS, phase 'denied' and no RealtimeKit request; a token the SDK cannot use ends in phase 'failed' after exactly one token request, with no retry and the token absent from the DOM; the invalid-token control fails without calling the endpoint; the phrase is shown and Join is disabled without a case. |
| Actual result | All four matched. The fake JWT was rejected by the SDK as TOKEN_REJECTED with 0 requests to realtime.cloudflare.com (the SDK validates the JWT shape/claims locally before any network call); token endpoint called once; token text absent from the DOM after 10 s; invalid-token control → TOKEN_REJECTED with 0 endpoint calls. Re-run at 2026-10-03T22:33:20Z after replacing the synthetic token/id constants (public-content scan): identical results; the full e2e/media suite passed 14/14. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-07-call.granted.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Client handling only. Proves nothing about the Apex boundary, RealtimeKit service-side rejection of tampered/revoked tokens, or any call. Required CALL-03 row stays BLOCKED (evidence/SMF-7/CALL-03.md). |
