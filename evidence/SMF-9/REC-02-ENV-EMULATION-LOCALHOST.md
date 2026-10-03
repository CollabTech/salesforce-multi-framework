# REC-02 — ENV-EMULATION-LOCALHOST — localhost exploratory (simulated transport) — not host evidence

| Field | Value |
|---|---|
| Case ID | REC-02 |
| Story | SMF-9 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | SIMULATED transport (probe mode 'Simulated transport', labelled in the UI); canvas video track |
| Build / commit | branch claude/smf-9-recovery working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:47:57Z |
| Preconditions | Simulated session joined; document.visibilityState overridden and visibilitychange dispatched (synthetic). |
| Steps | 1. Join (simulated) 2. Dispatch hidden then visible visibilitychange 3. Read the timeline |
| Expected result | Localhost-scoped statement (written before running): the timeline records 'hidden' and 'visible' entries with timestamps. |
| Actual result | Matched: timeline contains 'hidden hidden' and 'visible visible' entries. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-09-recovery.granted.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Synthetic events only; real background/lock/incoming-call behaviour of the Salesforce app is unknown until device runs. Required rows stay BLOCKED. |
