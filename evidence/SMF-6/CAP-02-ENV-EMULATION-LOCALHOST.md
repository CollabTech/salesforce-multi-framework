# CAP-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence

| Field | Value |
|---|---|
| Case ID | CAP-02 |
| Story | SMF-6 |
| Persona pair | none (no Salesforce session; logical persona MF-TECH not involved) |
| Fixture IDs / hash / version | Chromium synthetic fake camera (fake_device_0) and fake audio inputs (beep tone); no MF fixture used |
| Build / commit | branch claude/smf-6-capture working tree on base 7d6b5ea (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0 driving Chromium 141.0.7390.37 headless (UA string overridden by the Playwright 'Desktop Chrome' descriptor); bundle built with npm run build:e2e and served by `serve` on http://localhost:5176; no Salesforce runtime, no <base href>, not framed |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:06:48Z |
| Preconditions | Three Chromium launches: fake-devices-granted (fake devices, auto-accept), fake-devices-prompt (fake devices, --deny-permission-prompts, permission granted mid-test via context.grantPermissions), no-devices (no fake devices; the container has no camera/mic). |
| Steps | 1. fake-devices-prompt: click Camera + mic with permission denied; read error box; grant camera+microphone; click Camera + mic again 2. fake-devices-granted: start Camera + mic; click Simulate unavailable camera and Simulate unavailable mic; read error code and live tracks 3. fake-devices-granted: start Mic only; choose a different microphone in the selector; read event log, track label, observer track states 4. no-devices: click Camera only, then Mic only; read error code |
| Expected result | Localhost-scoped statement (written before running): denial shows NotAllowedError with no track, and the retry after granting yields live video+audio with no error box; simulated unavailable devices show OverconstrainedError while existing tracks stay live; switching microphone ends exactly one old audio track and shows a live track with a different label; with no hardware both modes show NotFoundError and no tracks. |
| Actual result | All four paths matched: NotAllowedError then successful retry; OverconstrainedError for both simulated devices with capture still live; mic switch 'Fake Default Audio Input' → 'Fake Audio Input 1', exactly one audio track ended (independent getUserMedia observer); NotFoundError for camera-only and mic-only on the device-less container. Camera switching not exercised: Chromium exposes a single fake camera. A test-timing bug (reading the label before the 200 ms poll) failed one earlier run; fixed in the test, not the probe. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-06-capture.*.media.ts; config e2e/media/playwright.config.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Chromium permission switches stand in for a human prompt; no real cancel dialog, OS settings change, or unplugged hardware was exercised. Camera switching untested. Required rows stay BLOCKED (evidence/SMF-6/CAP-02.md). |
