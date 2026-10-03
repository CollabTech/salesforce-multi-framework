# SYNC-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SYNC-02 |
| Story | SMF-12 |
| Persona pair | none (two local browser contexts labelled TECH/SUPPORT; no Salesforce session) |
| Fixture IDs / hash / version | synthetic pump PNG stand-in (e2e/support/syntheticPng.ts); MF-MARKUP-001 shapes as specified |
| Build / commit | 94e8f02 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: SMF-12 Node sync server (services/markup-sync, @tldraw/sync-core 5.5.2, SQLite per room) on 127.0.0.1:8791 with a throwaway key; two headless Playwright Chromium 141.0.7390.37 contexts ('TECH', 'SUPPORT') on the statically served bundle (build:e2e); tokens minted via the server's /mint as Apex would, allow/deny decided by the test harness; MOCK Files; Linux container, Node v22.22.0; loopback network |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:20:00Z |
| Preconditions | services/markup-sync built (npm run build); bundle built (build:e2e); no org. |
| Steps | npx playwright test e2e/markup-sync.spec.ts --workers=1 (x3); services/markup-sync: npx vitest run; npm run worker:dev + worker:smoke |
| Expected result | Before running: 20 simultaneous creates (10 per client) plus a contested move of one shape converge to the same count and the same final position in both; SUPPORT taken offline (DevTools) misses 5 TECH edits then converges after going online; after SIGKILL of the server and restart, a FRESH context sees every shape (SQLite persistence); a live client survives a second SIGKILL/restart and an edit it made while the server was down reaches the other client. |
| Actual result | As expected in 3 consecutive runs: contested shape x=1200 in both (last writer wins); reconnect convergence 69-84 ms after network restore; fresh client after crash+restart saw all 90 shapes; offline edit propagated after restart. |
| Outcome | PASS |
| Evidence link | evidence/SMF-12/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Restart is of the Node build; the Cloudflare Durable Object build cannot be restarted on demand here (workerd smoke only). Image asset recovery relies on Salesforce Files, not exercised (mock). Never a substitute for any required row. |
