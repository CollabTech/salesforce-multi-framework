# SMF-13 3D-01..03 — human-run script (physical Salesforce mobile; desktop fallback)

**Who:** Brandon or a designated device tester. **Personas:** MF-TECH (all steps); MF-SUPPORT
(3D-01 step 9 only). Credentials from `private/personas.json`; never MF-ADMIN.
**Org:** `smf-dev`. **App:** "Field Support PoC" → **Probes** → "SMF-13 · Interactive 3D
equipment". **Fixture:** MF-MODEL-SMALL sha256 `b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85`
(the page shows "Model hash matches: MF-MODEL-SMALL"; anything else = wrong build, stop).
**Build:** the commit on the Launch check page must match the PR head.

Desktop Edge/Chromium functional checks (3D-01 mouse/resize, 3D-03) are automated by
`scripts/cloud/stages/56-smf13-3d.sh`; run the desktop rows by hand only if the cloud stage is
BLOCKED and Brandon asks for it. **Physical-device rows are human-only.** A phone browser is a
separate exploratory row (ENV-MOBILE-SAFARI / ENV-MOBILE-CHROME), never ENV-SFMOBILE-*.

Before starting each row record: device model, OS version, Salesforce app version (Settings >
About), network (Wi-Fi/cellular, and a speed-test figure if available), battery saver on/off.
After each case tap **Copy for evidence** and paste the JSON into the device-result file
(`testing/device-results/TEMPLATE.md`); it contains timings, fps, renderer.info and the event
log, no IDs. Screenshots: crop the URL bar and any IDs.

## 3D-01 — load, orbit, zoom, select, reset, rotation, touch/resize

1. Open the probe. *Observe:* the pump appears and **Status: ready** within 10 s. Note the
   "Usable (interactive) after … ms" figure.
2. One-finger drag across the model. *Observe:* the model orbits smoothly with the finger.
3. Two-finger pinch out, then in. *Observe:* zoom in and out; the page itself does not zoom
   or scroll while the finger is on the 3D view.
4. Two-finger drag. *Observe:* the view pans.
5. Tap the blue round casing. *Observe:* it turns orange-highlighted and the label
   "Pump casing (volute) · MF-PART-CASING" appears top-left. Tap the grey motor: label changes
   to "Electric motor · MF-PART-MOTOR". Tap empty background: selection clears.
6. Tap **Reset view**. *Observe:* the camera returns to the starting 3/4 view, selection none.
7. Rotate the phone to landscape, wait 2 s, then back to portrait. *Observe:* the view fills
   its box after each rotation (no stretching, no black band), and interaction still works.
   The event log shows `orientation …` and `resize …` lines.
8. Switch to another app for 10 s and return. *Observe:* the 3D view is still shown and
   interactive, or the static image with "graphics context was lost" (record which).
9. (MF-SUPPORT, desktop or phone) Select "Suction inlet" from the **Parts** list, then tap the
   inlet pipe on the model. *Observe and judge:* the highlighted part is the part named in the
   label both times, and the label is readable. Record your judgement in your own words.

**PASS** for a row: steps 1–7 hold for MF-TECH (and step 9 for MF-SUPPORT on at least one
row). Any step failing → FAIL (or PARTIAL naming the failing steps).

## 3D-02 — 60 s repeatable interaction (device performance)

1. Close other apps; keep the phone in portrait; open the probe and wait for **ready**.
2. Tap **Run 60 s protocol** and do not touch the screen for 60 s (input is disabled; the
   camera path is scripted so every device sees the same views).
3. *Record* the "Usable (interactive) after … ms" value and the judgement line (median, p5,
   p95 fps, long frames). Tap **Copy for evidence**.
4. Repeat steps 1–3 twice more (fresh open each time); record all three runs.

**Targets (fixed, story 3D-02):** usable within 10 s **and** median ≥ 30 fps on the recorded
device/network. PASS only if every run meets both; report measured values even when below.

## 3D-03 — missing model, context loss, remount, fallback, released resources

1. Tap **Load missing model**. *Observe:* status **error**, the static pump image with the
   message "the model could not be loaded (…)" is shown. With VoiceOver/TalkBack on, *listen:*
   the image is announced as "Static rendering of synthetic pump MF-PUMP-001 …".
2. Tap **Retry loading MF-MODEL-SMALL**. *Observe:* the 3D view returns (ready).
3. Tap **Lose graphics context**. *Observe:* static image with "graphics context was lost".
   Tap **Restore graphics context**. *Observe:* 3D view back and interactive.
4. Tap **Unmount 3D view**. *Observe:* no 3D view; static image "3D view unmounted"; the
   Measurements card shows "Disposals: 1 (… geometries 0, textures 1 after release)".
5. Tap **Remount 3D view**. *Observe:* ready again. Repeat steps 4–5 twice.
6. Tap **Simulate no WebGL**. *Observe:* static image with "WebGL unavailable (simulated)".

**PASS** for a row: each step behaves as stated, every disposal shows geometries 0 after
release (the 1 remaining texture is three.js's shared DFG lookup table, released with the
renderer), and the app never shows a blank or frozen view.
