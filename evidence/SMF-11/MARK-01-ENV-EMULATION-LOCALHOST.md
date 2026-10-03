# MARK-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | MARK-01 |
| Story | SMF-11 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | synthetic pump PNG generated in e2e/support/syntheticPng.ts (stand-in, not SMF-3 MF-IMAGE-001); MF-MARKUP-001 annotations as specified |
| Build / commit | 8d33958 |
| Host / device / OS / app / browser | ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, viewport 1280x1400, Node v22.22.0, Linux container; tldraw 5.5.2 in development mode (localhost, no license key); MOCK Files transport + client-side MarkupApi (not atomic; the Salesforce path uses the Apex row lock) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:36:54Z |
| Preconditions | Bundle built; no org. |
| Steps | npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/markup-probe.spec.ts (x3); npx vitest run |
| Expected result | Before running (Playwright assertions): on a synthetic 800x600 pump PNG, mouse creates a red ellipse whose page bounds enclose the inlet rectangle, an arrow, and a text shape reading 'Inspect inlet' (probe check line all true); Ctrl+wheel zoom and wheel pan change the camera but not the shape summary; a CDP touch drag with the ellipse tool creates one geo shape. |
| Actual result | As expected in 3 consecutive runs: shapes arrow, geo/ellipse/red, image, text 'Inspect inlet'; ellipse enclosed the inlet; camera changed, summary unchanged; CDP touch created 1 ellipse. Earlier runs failed because of test-script defects (canvas off-screen, typing before text edit mode), fixed before the recorded runs. |
| Outcome | PASS |
| Evidence link | evidence/SMF-11/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | CDP touch emulation in Chromium is not a physical touchscreen or the Salesforce mobile app; readability on a phone is a human judgement. Never a substitute for any required row. |
