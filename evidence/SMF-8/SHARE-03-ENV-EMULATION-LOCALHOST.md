# SHARE-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SHARE-03 |
| Story | SMF-8 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | Chromium fake desktop capture (1280x720 monitor); placeholder fallback image |
| Build / commit | branch claude/smf-8-share working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:40:06Z |
| Preconditions | Project fake-devices-granted; 'Request screen audio' ticked; local share test path. |
| Steps | 1. Tick Request screen audio 2. Start local share test 3. Read the reported audio state 4. Stop |
| Expected result | Localhost-scoped statement (written before running): the probe reports the audio as either a live audio track or 'requested, not offered/selected' — never assumed from the checkbox. |
| Actual result | Reported 'audio audio live' (Chromium's fake capture supplies an audio track when audio is requested). |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-08-share.*.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Fake audio track; nothing was heard; real pickers decide whether audio is offered. Required rows stay BLOCKED. |
