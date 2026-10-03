# FILE-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | FILE-02 |
| Story | SMF-10 |
| Persona pair | none (no Salesforce session; mock transport) |
| Fixture IDs / hash / version | local stand-ins generated in e2e/files-probe.spec.ts to the MF-UPLOAD-INVALID spec (1x1 PNG, .txt, 5 MiB+1 PNG); not SMF-3 assets |
| Build / commit | 022583c |
| Host / device / OS / app / browser | Localhost exploratory, ENV-EMULATION-LOCALHOST: built bundle served by `npx serve` (build:e2e), Playwright Chromium 141.0.7390.37 headless, Node v22.22.0, Linux container; MOCK transport (?transport=mock, localhost-only guard) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:14:35Z |
| Preconditions | Bundle built; no org. |
| Steps | cd force-app/main/default/uiBundles/FieldSupport && npm run build:e2e && PW_CHROMIUM_PATH=... npx playwright test e2e/files-probe.spec.ts; npx vitest run |
| Expected result | Before running: the probe shows DENIED for a 404 from list/retrieve; the salesforceTransport maps HTTP 404/403 to NotFoundOrDeniedError and refuses non-Id path input; the probe source contains no ContentDistribution create or public download URL. |
| Actual result | As expected: e2e 'negative controls are denied' passed (mock 404s rendered as DENIED); vitest salesforceTransport tests passed (404 mapping, path-injection refusal, source scan for public links). |
| Outcome | PASS |
| Evidence link | evidence/SMF-10/logs/localhost-2026-10-03.txt |
| Tester | Implementing agent (automated) |
| Limitation / follow-up | Mock models the expected denial; real denial depends on org sharing (Apex USER_MODE) and is only provable as the personas. Never a substitute for any required row. |
