# SMF-11 MARK-01..04 — human-run script (desktop and physical Salesforce mobile)

**Who:** Brandon or a designated device tester. Desktop Edge/Chromium rows are automated by
`testing/cloud-e2e/tests/smf-11-markup.spec.ts` (stage 53); run this script for physical
Salesforce mobile (touch) and for Chrome until branded Chrome is available in the cloud.
**Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED (`private/personas.json`). **Fixtures:**
MF-CASE-001, MF-IMAGE-001, MF-MARKUP-001. **App:** Field Support PoC → Probes → "SMF-11 ·
Equipment markup in Salesforce Files". Record env rows exactly as in `SMF-10-FILES.md`.
Paste the probe's **Copy for evidence** block (Ids masked) into
`testing/device-results/` (template there) or `evidence/SMF-11/<CASE>-<ENV-ROW>.md`.

Pre-check (every row): the evidence block shows `gate: key-present` (or `not-required` only on
localhost). If the editor disappears after ~5 s, record "tldraw license missing/invalid for
this host" and stop: that row is BLOCKED (owner step H5).

## MARK-01 — create circle, arrow and label (mouse and touch); pan/zoom
1. As **MF-TECH**: paste MF-CASE-001's Id → **List case images** → select MF-IMAGE-001 →
   **Start new markup on this image**. *Observe:* the pump image appears.
2. Choose the ellipse tool (toolbar ▸ shapes ▸ ellipse), colour **red**, and draw a circle over
   the inlet — on desktop with the mouse, on mobile with a finger.
3. Pinch-zoom in/out (mobile) or Ctrl+scroll (desktop) and pan (two-finger drag / hand tool).
   *Observe:* the circle stays over the inlet at every zoom level.
4. **Save snapshot + export**. *Observe:* "Save: saved · r<n>" and the green export panel.
5. As **MF-SUPPORT** (separate session/device): **Reopen latest saved markup**, draw an arrow
   pointing at the inlet and a text label `Inspect inlet` (touch on mobile). Save.
6. *Record:* the "MF-MARKUP-001 check" line (must be all `true`), whether the label is readable
   at 100 % zoom on the device screen (human judgement), and any touch problems (e.g. page
   scrolls instead of drawing, Salesforce app gestures stealing the touch).

**PASS (row):** circle, arrow and label created with the row's input method; pan/zoom keeps
positions; label readable.

## MARK-02 — reopen as SUPPORT without browser-local state
1. Close the app/browser fully. On desktop use a new private window; on mobile log out and back
   in to the Salesforce app as **MF-SUPPORT**.
2. Open the probe, paste MF-CASE-001's Id, **Reopen latest saved markup**.
3. *Observe:* image + red circle + arrow + "Inspect inlet" all visible; export panel shows the
   annotated PNG; evidence block "base revision: r<n>" matches the last save.

**PASS (row):** everything restored in a fresh session.

## MARK-03 — failed save / retry and concurrent saves
1. TECH and SUPPORT both **Reopen latest** (same revision). Each adds a small rectangle.
2. TECH saves → saved. SUPPORT saves → *Expected:* red "Conflict: revision r… was saved by
   another session … Nothing was written." Record the text.
3. SUPPORT turns on airplane mode (desktop: DevTools offline) and taps **Save mine as a new
   revision on top** → *Expected:* "Save failed …". Reconnect → **Retry save** → saved.
4. MF-ADMIN: Files related list on MF-CASE-001 shows one snapshot+export pair per successful
   save, none lost or duplicated.

**PASS (row):** explicit conflict, no silent overwrite, one revision per successful save.

## MARK-04 — RESTRICTED denied
1. As **MF-RESTRICTED**: Markup probe → paste MF-CASE-001 → **Reopen latest** → *Expected:*
   "DENIED: Not found or no access."
2. Files probe (SMF-10) → retrieve the latest snapshot, export and MF-IMAGE-001 ContentVersion
   Ids (from `private/`) → each *Expected:* DENIED.

**PASS (row):** every attempt denied.

**Human-only observations:** touch drawing on physical devices, readability of callouts on a
phone, Salesforce-app gesture conflicts, license watermark/behaviour on the device host.
