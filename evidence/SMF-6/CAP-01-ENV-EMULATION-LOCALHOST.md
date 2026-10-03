# CAP-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | CAP-01 |
| Story | SMF-6 |
| Persona pair | none (no Salesforce session; logical persona MF-TECH not involved) |
| Fixture IDs / hash / version | Chromium synthetic fake camera (fake_device_0) and fake audio inputs (beep tone); no MF fixture used |
| Build / commit | branch claude/smf-6-capture working tree on base 7d6b5ea (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0 driving Chromium 141.0.7390.37 headless (UA string overridden by the Playwright 'Desktop Chrome' descriptor); bundle built with npm run build:e2e and served by `serve` on http://localhost:5176; no Salesforce runtime, no <base href>, not framed |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:06:48Z |
| Preconditions | Project fake-devices-granted: --use-fake-device-for-media-stream --use-fake-ui-for-media-stream (prompts auto-accepted). |
| Steps | 1. Open /probes/capture 2. Click Camera only; read track table and frame counter 3. Click Mic only; read track table and mic peak 4. Click Camera + mic; read both; wait 3 s; record frames and peak |
| Expected result | Localhost-scoped statement (written before the recorded run): with Chromium fake devices, Camera only yields exactly one video track readyState=live and the frame counter exceeds 5; Mic only yields exactly one audio track live and mic peak > 0; Camera + mic yields both live with both activity indicators moving. |
| Actual result | All three passed. Combined capture after ~3 s: 'Frames rendered: 86 (live)', 'Peak since start: 0.044 · audio context: running'; tracks 'Fake Default Audio Input' (sampleRate=48000, channelCount=1, echoCancellation/noiseSuppression/autoGainControl=true) and 'fake_device_0'. Disclosure: in a first run (22:04Z) the mic assertions used an unrecorded agent-chosen threshold peak > 0.01 and failed (measured 0.006 on the fake beep); that value was an implementation guess, not a story target, and the statement above (peak > 0) was fixed before the recorded run. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-06-capture.*.media.ts; config e2e/media/playwright.config.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Proves probe logic only. Says nothing about Salesforce hosts, real prompts, real cameras/mics or physical mobile. Required rows stay BLOCKED (evidence/SMF-6/CAP-01.md). |
