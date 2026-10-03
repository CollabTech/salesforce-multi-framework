# SHARE-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | SHARE-01 |
| Story | SMF-8 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | Chromium fake desktop capture (1280x720 monitor); placeholder fallback image |
| Build / commit | branch claude/smf-8-share working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:40:06Z |
| Preconditions | Project fake-devices-granted (--use-fake-ui-for-media-stream auto-accepts getDisplayMedia). Local share test path (no call). Independent getDisplayMedia observer. |
| Steps | 1. Open /probes/share; read host verdict 2. Start local share test; wait for preview frames 3. Stop; Start again; Stop 4. Read observer track states 5. Open /probes/diagnostic-screen; compare two canvas samples 700 ms apart |
| Expected result | Localhost-scoped statement (written before running): verdict api-present; start yields a live screen video track and >3 preview frames; stop shows 'not sharing'; restart works; every observed screen track ends; the diagnostic canvas changes within 700 ms. |
| Actual result | Matched. First share: 'video live [displaySurface=monitor, width=1280, height=720, frameRate=30, logicalSurface=true, cursor=never]'; observer after two start/stop cycles: video:ended, video:ended; diagnostic canvas changed. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-08-share.*.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Fake capture, no picker, no call, no receiver. Says nothing about SHARE-01 in any host. Required rows stay BLOCKED. |
