# FILE-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | FILE-01 |
| Story | SMF-10 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | local stand-ins generated in e2e/files-probe.spec.ts to the MF-UPLOAD-INVALID spec (1x1 PNG, .txt, 5 MiB+1 PNG); not SMF-3 assets |
| Build / commit | 022583c |
| Host / device / OS / app / browser | Localhost exploratory, ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, Node v22.22.0, Linux container; MOCK transport (?transport=mock, localhost-only guard) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:14:35Z |
| Preconditions | Bundle built; no org. |
| Steps | cd force-app/main/default/uiBundles/FieldSupport && npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/files-probe.spec.ts; npx vitest run |
| Expected result | Before running (encoded as Playwright assertions written before the first run): with the mock transport, selecting a valid PNG shows a dashed panel labelled 'Browser-local preview — NOT persisted' and no persisted panel; after Upload the persisted panel appears only after read-back with linked-to-case=true, files-with-key=1, SHA-256 match=true; the evidence block shows masked Ids only. |
| Actual result | As expected: e2e 'valid image: local preview is labelled not persisted, then persisted read-back is shown' passed; evidence block contained 'ContentDocument 069…AAA ContentVersion 068…AAA v1' and not the full mock case Id. |
| Outcome | PASS |
| Evidence link | evidence/SMF-10/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Says nothing about Salesforce: the mock models linking and read-back. Fresh-session SUPPORT read cannot be emulated (in-memory store). Never a substitute for any required row. |
