# MARK-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | MARK-02 |
| Story | SMF-11 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | synthetic pump PNG generated in e2e/support/syntheticPng.ts (stand-in, not SMF-3 MF-IMAGE-001); MF-MARKUP-001 annotations as specified |
| Build / commit | 8d33958 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, viewport 1280x1400, Node v22.22.0, Linux container; tldraw 5.5.2 in development mode (localhost, no license key); MOCK Files transport + client-side MarkupApi (not atomic; the Salesforce path uses the Apex row lock) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:36:54Z |
| Preconditions | Bundle built; no org. |
| Steps | npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/markup-probe.spec.ts (x3); npx vitest run |
| Expected result | Before running: after save r1 the export read-back image renders (naturalWidth > 100); the saved snapshot JSON contains 'asset:sfcv/' and no data:/blob: URLs; page A has no tldraw IndexedDB; a NEW browser context with empty localStorage and IndexedDB, seeded only with the mock server's File state, reopens r1 with an identical shape summary and the image rendered; no request leaves localhost (tldraw assets self-hosted). |
| Actual result | As expected in 3 consecutive runs (storage in fresh context: 0 localStorage keys, 0 IndexedDB databases; external requests: none). |
| Outcome | PASS |
| Evidence link | evidence/SMF-11/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | The 'server' is the in-memory mock carried across contexts by the test; Salesforce persistence and SUPPORT-persona access are not exercised. Never a substitute for any required row. |
