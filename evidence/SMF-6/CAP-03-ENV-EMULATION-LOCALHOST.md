# CAP-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | CAP-03 |
| Story | SMF-6 |
| Persona pair | none (no Salesforce session; logical persona MF-TECH not involved) |
| Fixture IDs / hash / version | Chromium synthetic fake camera (fake_device_0) and fake audio inputs (beep tone); no MF fixture used |
| Build / commit | branch claude/smf-6-capture working tree on base 7d6b5ea (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0 driving Chromium 141.0.7390.37 headless (UA string overridden by the Playwright 'Desktop Chrome' descriptor); bundle built with npm run build:e2e and served by `serve` on http://localhost:5176; no Salesforce runtime, no <base href>, not framed |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:06:48Z |
| Preconditions | Project fake-devices-granted. An init script wraps getUserMedia/getDisplayMedia to keep every returned track (independent of the probe's own report). |
| Steps | 1. Start Camera + mic; confirm live 2. Click Leave probe (CAP-03) (SPA navigation → unmount) 3. Read readyState of every observed track 4. Re-open the SMF-6 probe; read the Last leave/unmount box 5. Separately: start Camera + mic, click Stop all, read observer states |
| Expected result | Localhost-scoped statement (written before running): after leaving, every track observed by the independent wrapper reads 'ended' (at least 2 tracks), the probe's last-leave box reports 'unmount' and 'all ended: true'; Stop all also ends every track and empties the table. |
| Actual result | Matched: all observed tracks 'ended' after unmount (video and audio); last-leave box showed 'unmount … all ended: true'; Stop all emptied the table and every observed track was 'ended'. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-06-capture.*.media.ts; config e2e/media/playwright.config.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | An OS camera/mic indicator cannot be observed in headless Chromium; host navigation (Salesforce back button, app backgrounding) not exercised. Required rows stay BLOCKED (evidence/SMF-6/CAP-03.md). |
