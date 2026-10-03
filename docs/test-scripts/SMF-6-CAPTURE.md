# SMF-6 CAP-01..03 — human-run script (desktop and physical Salesforce mobile)

**Who:** Brandon or a designated device tester (handles every browser/OS permission prompt).
**Persona:** MF-TECH only (credentials from `private/personas.json`; never MF-ADMIN).
**Org:** `smf-dev`. **App:** "Field Support PoC" → *Capability probes* → *SMF-6 · Camera and
microphone capture* (route `/probes/capture`). **Build:** the `build:` line in the probe's
diagnostics block must match the PR head under test.
**Fixture:** MF-ASSET-001 context — point the camera at a printed/onscreen synthetic picture
of pump MF-PUMP-001 (no people, no customer premises, no location). **Nothing is recorded,
stored or uploaded by the probe;** do not screen-record faces.

**Preconditions (all must hold, else the row is BLOCKED):** SMF-2 ENV-01..03 observed; SMF-3
MF-TECH provisioned with `FieldSupport_Access`; SMF-4 app deployed and HOST-01 passed in the
same env row (the app must launch before capture can be tested there).

**Cloud-first split.** On desktop rows the agent runs the functional part automatically
(`scripts/cloud/stages/52-smf6-capture-e2e.sh` → `testing/cloud-e2e/tests/smf-6-capture.spec.ts`,
Microsoft Edge on Linux and Playwright Chromium with **fake** camera/mic, as MF-TECH in the
real Salesforce host). That run never attests a real device. A person still does, per desktop
row: CAP-01 steps 2–4 "Human attests" observations with a real webcam/mic, CAP-02 steps 1–2
(real browser prompt deny/cancel and settings change) and step 4 (real unavailable hardware),
and CAP-03 step 2 (camera light/OS indicator off). Mobile rows are entirely human. Results go
in `testing/device-results/` (template there); the agent writes the evidence records.

Record each run in `evidence/SMF-6/<CASE>-<ENV-ROW>.md` (`evidence/TEMPLATE.md`), pasting the
probe's **Copy diagnostics** block. **Camera and mic results are recorded separately** (two
lines per row in the record: `camera:` and `mic:`).

| Env row | Record first |
|---|---|
| ENV-DESKTOP-CHROME | Chrome version (chrome://version), OS version, camera/mic models |
| ENV-DESKTOP-EDGE | Edge version (edge://version), OS version, camera/mic models |
| ENV-SFMOBILE-IOS | Device model, iOS version, Salesforce app version (Settings > About) |
| ENV-SFMOBILE-ANDROID | Device model, Android version, Android System WebView version, Salesforce app version |
| ENV-MOBILE-SAFARI / ENV-MOBILE-CHROME | exploratory only; never satisfies ENV-SFMOBILE-* |

Before step 1 on each row, reset the site permission to "Ask" (desktop: lock icon → Site
settings → Camera/Microphone → Ask; iOS: Settings → Salesforce → Camera/Microphone ON at OS
level; Android: App info → Salesforce → Permissions → "Ask every time" where offered). Note
the starting state in the record.

## CAP-01 — camera-only, mic-only, combined from a user gesture

1. Open the probe. *Observe and record:* section 4 "Host policy observations" (secure
   context, framed, APIs present, Permissions-Policy values, permission state). These are
   observations only — they do not prove capture.
2. Tap **Camera only**. *Record:* whether an OS/browser/Salesforce prompt appeared and its
   exact wording; accept it. *Observe:* track table shows one `video` row with `readyState
   live`; the preview shows the synthetic scene moving (wave a hand-held pump picture);
   "Frames rendered" increases. *Human attests:* the preview is the real camera image.
3. Tap **Mic only**. Accept any prompt. *Observe:* one `audio` row `live`; speak "pump
   inlet check one two three" — the level meter moves and "Peak since start" rises above
   0. *Human attests:* the meter follows your voice (silence → low, speech → high).
4. Tap **Camera + mic**. *Observe:* both rows `live`, preview moving, meter responding.
5. Tap **Copy diagnostics** and paste into the record.

**PASS (per row, separately for camera and mic):** the matching track is `live` and
activity is observed (frames increase and the tester sees the scene / the meter follows
speech). **FAIL:** a granted prompt but no live track or no activity. **PARTIAL:** e.g.
camera passes and mic fails — record each half separately.

## CAP-02 — deny/cancel, retry, unavailable hardware, device switching

1. Reset permission to "Ask". Tap **Camera only** and **deny** (or dismiss/cancel) the
   prompt. *Observe/record:* the red error box text and code (expected `NotAllowedError`),
   and that no track row appears. Repeat with **Mic only**.
2. **Retry:** change the permission to Allow (desktop site settings; iOS Settings →
   Salesforce; Android App info), return, tap the same button again. *Record:* whether the
   app had to be reloaded/restarted for the change to take effect, and the outcome.
3. **Simulated unavailable device:** tap **Simulate unavailable camera** and **…mic**.
   *Observe:* the error box reports the runtime's real code (expected `OverconstrainedError`
   or `NotFoundError`) while any live capture keeps running.
4. **Real unavailable hardware** (desktop: unplug/disable the webcam or headset, or open
   the camera in another app first; mobile: start the camera in another app where the OS
   allows, or skip and record NOT TESTED with reason). Tap the start button. *Record* the
   exact code (`NotFoundError` / `NotReadableError` / other).
5. **Switch devices where exposed:** start **Camera + mic**, then choose a different camera
   (e.g. front ↔ back on mobile) and a different microphone in the selectors. *Observe:* the
   event log shows `switched video …` / `switched audio …`, the old track reads `ended`
   and the new one `live`; the preview/meter keep working. If only one device is exposed,
   record "not offered" with the count shown.
6. **Copy diagnostics** into the record.

**PASS:** every attempted path shows the real outcome in the UI (no silent failure, no
fake success) and the retry works after the permission is granted. A path the host does
not offer is recorded as not offered (not as PASS).

## CAP-03 — leave/unmount stops capture

1. Tap **Camera + mic**; confirm both `live` and the OS camera/mic indicator is on
   (desktop tab/camera light; iOS green/orange dot; Android privacy indicator).
2. Tap **Leave probe (CAP-03)**. *Observe and record:* the camera light / OS indicator
   turns off (time it: < 2 s expected).
3. Open the SMF-6 probe again. *Observe:* the "Last leave/unmount" box says `unmount` and
   `all ended: true` with `video:ended, audio:ended`.
4. Repeat steps 1–3 using **Stop all** instead of leaving; then using the host's own
   navigation (Salesforce mobile back button / switching to another app tab).
5. Mobile only: with capture live, send the Salesforce app to the background for 10 s and
   return. *Record* whether capture stopped, kept running, or needs a new gesture (finding,
   not a pass/fail of CAP-03).

**PASS (camera and mic separately):** after leave/stop the indicator is off and the probe
reports every track `ended`. **FAIL:** an indicator stays on or a track is not `ended`.

Only a human can attest: the preview is the live scene, the meter follows speech, and the
OS indicator turned off.
