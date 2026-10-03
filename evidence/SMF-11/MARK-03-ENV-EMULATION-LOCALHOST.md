# MARK-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | MARK-03 |
| Story | SMF-11 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | synthetic pump PNG generated in e2e/support/syntheticPng.ts (stand-in, not SMF-3 MF-IMAGE-001); MF-MARKUP-001 annotations as specified |
| Build / commit | 8d33958 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, viewport 1280x1400, Node v22.22.0, Linux container; tldraw 5.5.2 in development mode (localhost, no license key); MOCK Files transport + client-side MarkupApi (not atomic; the Salesforce path uses the Apex row lock) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:36:54Z |
| Preconditions | Bundle built; no org. |
| Steps | npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/markup-probe.spec.ts (x3); npx vitest run |
| Expected result | Before running: with an injected upload failure the save shows an error and Retry save produces r1 with exactly one snapshot File; when another session saves r2 on top of r1, saving from r1 shows 'Conflict: revision r2', writes nothing (2 snapshots), and 'Save mine as a new revision on top' yields r3 with r1..r3 preserved (3 snapshots). |
| Actual result | As expected in 3 consecutive runs; vitest also covers stale-base conflict without writes, idempotent save key and image-not-linked rejection on the mock API. |
| Outcome | PASS |
| Evidence link | evidence/SMF-11/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | The 'other session' is an API call in the same page; the mock check-then-write is not atomic — atomicity is the Apex Case row lock, which cannot run here. Never a substitute for any required row. |
