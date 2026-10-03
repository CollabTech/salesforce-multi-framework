# SHARE-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SHARE-02 |
| Story | SMF-8 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | Chromium fake desktop capture (1280x720 monitor); placeholder fallback image |
| Build / commit | branch claude/smf-8-share working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:40:06Z |
| Preconditions | Project fake-devices-prompt (--deny-permission-prompts). Three runs: unmodified; getDisplayMedia STUBBED to reject NotAllowedError; getDisplayMedia STUBBED as missing. |
| Steps | 1. Unmodified: Start local share test; wait 5 s 2. Stubbed rejection: Start local share test; read outcome and fallback 3. Stubbed missing API: read verdict; Start local share test |
| Expected result | Localhost-scoped statement (written before the first run): with --deny-permission-prompts, starting a local share shows CANCELLED_OR_DENIED, the fallback image, and 'not sharing'. |
| Actual result | FIRST RUN (minutes before 22:40Z) FAILED the statement: Chromium 141 headless with --deny-permission-prompts left getDisplayMedia pending — no outcome after 5 s (harness limitation; no picker exists headless). Follow-up runs at 22:40Z (separate statements written before them): stubbed NotAllowedError → CANCELLED_OR_DENIED, fallback image visible, 'not sharing' (matched); stubbed missing getDisplayMedia → verdict unsupported-api, fallback visible, start → NOT_SUPPORTED (matched). |
| Outcome | PARTIAL |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-08-share.*.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | The real cancel/deny path could not be produced by the harness (stubs only). No call, so 'call stays usable' is only unit-tested (CallSession.setScreenShare). Mobile hosts untested. Required rows stay BLOCKED. |
