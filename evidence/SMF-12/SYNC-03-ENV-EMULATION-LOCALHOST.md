# SYNC-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SYNC-03 |
| Story | SMF-12 |
| Persona pair | none (two local browser contexts labelled TECH/SUPPORT; no Salesforce session) |
| Fixture IDs / hash / version | synthetic pump PNG stand-in (e2e/support/syntheticPng.ts); MF-MARKUP-001 shapes as specified |
| Build / commit | 94e8f02 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: SMF-12 Node sync server (services/markup-sync, @tldraw/sync-core 5.5.2, SQLite per room) on 127.0.0.1:8791 with a throwaway key; two headless Playwright Chromium 141.0.7390.37 contexts ('TECH', 'SUPPORT') on the statically served bundle (build:e2e); tokens minted via the server's /mint as Apex would, allow/deny decided by the test harness; MOCK Files; Linux container, Node v22.22.0; loopback network |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:20:00Z |
| Preconditions | services/markup-sync built (npm run build); bundle built (build:e2e); no org. |
| Steps | npx playwright test e2e/markup-sync.spec.ts --workers=1 (x3); services/markup-sync: npx vitest run; npm run worker:dev + worker:smoke |
| Expected result | Before running: when the token minter refuses (stand-in for Apex denying MF-RESTRICTED) the client never syncs and shows 'Not found or no access'; a member who cannot read the image File sees the shared shapes but the image does not render; with 8 s tokens and a 1 s re-check, after revocation (minter refuses) the live session is cut no later than TTL + re-check (+2 s slack) and does not come back. Service unit tests: no/malformed/bad-signature/expired tokens 401, wrong room 403, /mint without key 401. |
| Actual result | As expected in 3 consecutive runs: denial shown; unreadable image not rendered (naturalWidth 0); session cut 4.8-5.3 s after revocation = 6.8-7.3 s after join (server event session-expired), stayed disconnected 5 s. Unit tests 6/6. Worker (workerd) smoke: no token 401, wrong room 403, expired 401, valid 101. |
| Outcome | PASS |
| Evidence link | evidence/SMF-12/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Allow/deny comes from the test harness, not Salesforce sharing; real enforcement timing with defaults (TTL 300 s, re-check 15 s) must be measured on the host. Never a substitute for any required row. |
