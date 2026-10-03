# SYNC-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SYNC-01 |
| Story | SMF-12 |
| Persona pair | none (two local browser contexts labelled TECH/SUPPORT; no Salesforce session) |
| Fixture IDs / hash / version | synthetic pump PNG stand-in (e2e/support/syntheticPng.ts); MF-MARKUP-001 shapes as specified |
| Build / commit | 94e8f02 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: SMF-12 Node sync server (services/markup-sync, @tldraw/sync-core 5.5.2, SQLite per room) on 127.0.0.1:8791 with a throwaway key; two headless Playwright Chromium 141.0.7390.37 contexts ('TECH', 'SUPPORT') on the statically served bundle (build:e2e); tokens minted via the server's /mint as Apex would, allow/deny decided by the test harness; MOCK Files; Linux container, Node v22.22.0; loopback network |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:20:00Z |
| Preconditions | services/markup-sync built (npm run build); bundle built (build:e2e); no org. |
| Steps | npx playwright test e2e/markup-sync.spec.ts --workers=1 (x3); services/markup-sync: npx vitest run; npm run worker:dev + worker:smoke |
| Expected result | Before running (assertions): both contexts reach 'synced (online)', each shows the other in presence, the image placed by TECH appears for SUPPORT, the MF-MARKUP-001 check (red circle, arrow, 'Inspect inlet') is true in both, and over 30 edits each way the p95 propagation delay (creator timestamp to receiver store event, same machine clock) is <= 2000 ms. |
| Actual result | As expected in 3 consecutive runs. Propagation (ms) all 60 edits: run1 median 65 / p95 77 / max 95; run2 median 63 / p95 72 / max 77; run3 median 65 / p95 73 / max 84. |
| Outcome | PASS |
| Evidence link | evidence/SMF-12/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Loopback only: says nothing about a 'recorded stable network', Salesforce hosting or devices. Shapes created programmatically (mouse drawing proven in SMF-11 localhost). Never a substitute for any required row. |
