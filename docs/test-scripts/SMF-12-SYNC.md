# SMF-12 SYNC-01..04 — human-run script (physical Salesforce mobile pairs; desktop backup)

**Who:** Brandon or a designated tester with two devices/sessions at once. Desktop Edge/Chromium
rows are automated by `testing/cloud-e2e/tests/smf-12-sync.spec.ts` (stage 72).
**Personas:** MF-TECH and MF-SUPPORT simultaneously (separate devices or browser profiles),
MF-RESTRICTED. **Fixtures:** MF-CASE-001 (room MF-ROOM-001), MF-CASE-002 (MF-ROOM-002),
MF-IMAGE-001, MF-MARKUP-001. **App:** Field Support PoC → Probes → "SMF-12 · Live two-user markup".
Prerequisites: stages 46, 48, 49 green (Worker deployed for the observed app origin, secrets set and verified by stage 49, licence key).
Record per pair: both devices' env rows (see `SMF-10-FILES.md`), network type (Wi-Fi/cellular,
signal), and paste both evidence blocks.

## SYNC-01 — converge + presence (pairs: desktop TECH ↔ iPhone SUPPORT; desktop TECH ↔ Android SUPPORT)
1. Both: open the probe, paste MF-CASE-001's Id, **Join live markup**. *Observe:* status
   "synced (online)"; "Others here" shows the other person's name.
2. TECH: if no image, tap **Place case image**. *Observe on SUPPORT:* image appears.
3. TECH draws the red circle over the inlet; SUPPORT (phone, finger) draws the arrow and the text
   "Inspect inlet". *Observe:* each sees the other's shapes and cursor.
4. Delay: TECH says "now" while drawing a small rectangle; SUPPORT stops a stopwatch when it
   appears. Repeat 10 times each direction; record each value (human-timed, ±0.3 s).

**PASS (pair):** convergence + presence, and every delay ≤ 2 s on the recorded network.

## SYNC-02 — concurrent edits, disconnect/reconnect, restart
1. Both draw at the same time for ~10 s; then both drag the same rectangle. *Observe:* both
   end with identical shapes and the rectangle in the same place.
2. Phone: airplane mode for 20 s while TECH draws 3 shapes; turn it off. *Observe:* phone
   reconnects ("synced (online)") and shows the 3 shapes; anything the phone drew offline appears on desktop.
3. Agent (or owner) redeploys the Worker (`npx wrangler deploy` in `services/markup-sync`) while both
   are connected. *Observe:* both reconnect; nothing lost.

## SYNC-03 — denials and revocation
1. MF-RESTRICTED on a phone: join MF-CASE-001 → *Expected:* status shows "token: Not found or no access".
2. MF-TECH: join MF-CASE-002 → *Expected:* same denial.
3. While SUPPORT is connected, MF-ADMIN removes SUPPORT's access (remove `SMF12_Access`, or the SMF-3
   case grant). Start a stopwatch. *Record:* time until SUPPORT's status leaves "synced (online)"
   (bound: 300 s TTL + 15 s re-check) and that it does not come back. Restore the grant.

## SYNC-04 — desktop ↔ physical mobile, final Files association
1. Run SYNC-01 steps 1–3 on each pair (desktop Chrome or Edge ↔ iPhone; ↔ Android).
2. Both tap **Save snapshot + export** at the same moment. *Expected:* one "saved · r<n>", the
   other "another session saved r<n>; nothing was written"; the latter taps **Save as a new revision on top** → r<n+1>.
3. MF-ADMIN: MF-CASE-001 → Files shows `MF-MARKUP-001 snapshot r<n>`/`export r<n>` pairs, each
   export's Description referencing its snapshot. Reopen in the SMF-11 probe → all annotations present.
Record missed targets as FAIL/PARTIAL.

**Human-only observations:** device presence/cursor display, touch drawing, cellular behaviour,
stopwatch delays, reconnect behaviour after airplane mode.
