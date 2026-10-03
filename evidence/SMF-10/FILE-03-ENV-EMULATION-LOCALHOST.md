# FILE-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | FILE-03 |
| Story | SMF-10 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | local stand-ins generated in e2e/files-probe.spec.ts to the MF-UPLOAD-INVALID spec (1x1 PNG, .txt, 5 MiB+1 PNG); not SMF-3 assets |
| Build / commit | 022583c |
| Host / device / OS / app / browser | Localhost exploratory, ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, Node v22.22.0, Linux container; MOCK transport (?transport=mock, localhost-only guard) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:14:35Z |
| Preconditions | Bundle built; no org. |
| Steps | cd force-app/main/default/uiBundles/FieldSupport && npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/files-probe.spec.ts; npx vitest run |
| Expected result | Before running: .txt → rejected (type-not-allowed) and a 5 MiB+1 byte PNG → rejected (too-large, 'limit is 5.00 MiB'), upload disabled, no File created; cancel mid-upload → 'cancelled', retry → 1 File for the key; injected upload failure → error, retry → 1 File; injected link failure → retry reuses the body (uploadBody calls 1, createVersion 2) → 1 File; response lost after commit → no second write (createVersion 1) → 1 File. Unit: exactly 5 MiB accepted, renamed text-as-.png rejected, HEIC rejected. |
| Actual result | As expected: all 6 FILE-03 e2e tests passed; vitest policy and upload-flow tests passed (30/30 bundle tests). |
| Outcome | PASS |
| Evidence link | evidence/SMF-10/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Network failure is injected in the mock, not produced by a real Salesforce upload endpoint; cancel timing against real upload speed is unmeasured. Never a substitute for any required row. |
