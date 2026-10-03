# SMF-14 BUDGET-01..04 — human-run script (physical devices; desktop hardware for performance)

**Who:** Brandon or a designated device tester. **Personas:** MF-TECH (BUDGET-01/02/03);
MF-RESTRICTED (BUDGET-03 denial). Never MF-ADMIN. **Org:** `smf-dev`.
**App:** "Field Support PoC" → **Probes** → "SMF-14 · 3D delivery and budget".
**Fixtures** (provisioned by `scripts/cloud/stages/47-smf14-model-files.sh`; Ids in
`private/smf14-model-files.json`, never in public files):

| Fixture | Bytes | sha256 | Triangles | Textures | Linked to |
|---|---|---|---|---|---|
| MF-MODEL-SMALL | 317,796 | `b57acb02…f3ab` | 8,676 | 0 | MF-CASE-001 |
| MF-MODEL-REP | 8,647,528 | `52eb2bab…49a5` | 240,692 | 4 PNG (3×1024², 1×512²), embedded | MF-CASE-001 |
| MF-MODEL-SMALL-DENIED / MF-MODEL-REP-DENIED | same bytes | same | | | MF-CASE-002 only |

Full hashes: `testing/fixtures/models/manifest.json`. The probe checks each delivered file's
sha256 and shows the fixture name; "unknown hash" = wrong file, stop and report.

Desktop Edge/Chromium BUDGET-03 delivery/denial is automated (`57-smf14-budget.spec`); the
cloud harness numbers are software-rendered and never a budget. **Human rows:** physical
Salesforce mobile iOS and Android (all cases), and desktop Chrome/Edge **on real hardware** for
BUDGET-01/02 performance. Record device model, OS, Salesforce app (or browser) version, network
type and a speed-test figure, battery level and power-saving state before each row.

## Setup (every row)
1. Open the probe as MF-TECH. Set **Environment row** to the row you are testing and type the
   device/OS/app version into **Device / browser**.
2. Paste the MF-CASE-001 Id from `private/fixtures.json` into **Case Id**. Tap **List model
   Files on the case**. *Observe:* MF-MODEL-SMALL and MF-MODEL-REP listed with their sizes.

## BUDGET-01 — compare the two models with the same protocol
3. **Delivery path:** "Connect REST file content". Tap **Run harness for all listed models**.
   Do not touch the phone for ~3–6 minutes (each model: 5 open/close cycles, then the 60 s
   scripted protocol). Keep the screen on.
4. When "Working" disappears, tap **Copy for evidence** and paste the JSON into the
   device-result file. *Record* per model: interactive ms of each open, median/p5/p95 fps,
   long frames, renderer.info counts, JS heap (if shown), any error.
5. Repeat steps 3–4 once more (two runs per row).

**Targets (fixed):** every open usable ≤ 10 s and median ≥ 30 fps. Report values even below.

## BUDGET-02 — repeat open/close, orientation, foreground recovery
6. The harness in step 3 already did 5 open/close cycles per model: *check* in the JSON that all
   5 cycles are `ok: true` and each `dispose.afterResourceDispose.geometries` is 0.
7. Tap **Open** on MF-MODEL-REP. Wait for "3D view: MF-MODEL-REP · ready". Rotate the phone to
   landscape and back twice. *Observe:* the view resizes correctly and still responds to drag.
8. Press Home (send the Salesforce app to background) for 30 s, then return. *Observe and
   record:* the log line "foreground recovery: 3D view live …" or "context still lost … static
   fallback". If the fallback shows, tap **Close and reopen** and record whether the model loads.
9. Repeat step 8 with a 5-minute background period. Record any crash, reload of the whole app,
   or Salesforce error banner (exact text).

**PASS** for a row: all cycles succeed without errors or context loss, the view survives
rotation, and after each background period it is live or recovers via the fallback without
an app crash. Record degradation (slower opens in later cycles, growing heap) as observed.

## BUDGET-03 — authorized delivery and denial
10. As MF-TECH, with each **Delivery path** in turn, tap **Check delivery** on both models.
    *Observe:* `delivered` with the fixture name, or the exact error (the Apex path may refuse
    MF-MODEL-REP because of the Apex heap limit — record exactly what it says).
11. Still MF-TECH: paste the MF-MODEL-SMALL-DENIED Id (version Id for the Apex path, document
    Id for the Connect path) into **Id expected to be denied** → **Try fetch**. *Observe:* `denied`.
12. Log out; log in as MF-RESTRICTED. Open the probe, paste the MF-CASE-001 Id, tap **List**.
    *Observe:* "Listing refused or failed". Paste the MF-MODEL-SMALL and MF-MODEL-REP Ids (both
    paths) into the denial box. *Observe:* `denied` for every attempt; no 3D view.
13. As MF-TECH, **Check delivery** on "MF-MODEL-SMALL bundled app asset". *Observe:*
    `delivered` — this path is NOT checked against case/Files sharing; it is reported, not hidden.

**PASS:** every MF-TECH case-001 fetch delivers the right hash on at least one path, every
denial control is denied, RESTRICTED gets no bytes, and no asset path other than the documented
bundled asset delivers without an access check.

## BUDGET-04 — budget and fallback trigger
14. Nothing extra to run: the **Budget** card derives, per device, the largest fixture that met
    every target on that device, from the runs in this session; software renderers and
    non-required rows are excluded automatically. Copy the JSON after all runs on a device.
