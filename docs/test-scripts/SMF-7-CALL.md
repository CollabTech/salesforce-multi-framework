# SMF-7 CALL-01..03 — human-run script (two people, desktop and physical Salesforce mobile)

**Who:** two testers (or Brandon + a designated tester) in **separate places or with headsets**
so each hears only the call audio. **Personas:** MF-TECH and MF-SUPPORT in independent
sessions (separate browsers/devices; never one person in both); MF-RESTRICTED for CALL-03.
**Org:** `smf-dev`. **App:** Field Support PoC → Capability probes → *SMF-7 · Two-person call*.
**Room:** MF-ROOM-001 = the call room of MF-CASE-001 (bound server-side). **Build:** `build:`
line of the diagnostics block = PR head under test.

**Preconditions (else BLOCKED):** stage 45 printed `OK RealtimeKit reachable…` (owner step
O-SMF7-1 done); SMF-6 CAP-01 passed in the same env rows (capture works there); SMF-4 HOST-01
passed in those rows.

**Cloud-first split.** Desktop CALL-03 (all controls) and the *functional* part of CALL-01/02
(join, media flowing both ways, marker decoded remotely, mute/camera/leave propagation) run
automatically in stage 53 with fake devices. People do only what automation cannot attest:
**audio heard, video seen, real devices, and every mobile row**. Results go in
`testing/device-results/` (template there); the agent writes the evidence.

Record per row: device model / OS / browser or Salesforce app version, network (Wi-Fi/cellular),
time. Paste each side's **Copy diagnostics** block. Record **send and receive separately**.

| Pair | TECH side | SUPPORT side |
|---|---|---|
| A desktop↔desktop | ENV-DESKTOP-CHROME | ENV-DESKTOP-EDGE (then swap browsers) |
| B desktop↔iOS | ENV-SFMOBILE-IOS (Salesforce app) | ENV-DESKTOP-CHROME or EDGE |
| C desktop↔Android | ENV-SFMOBILE-ANDROID (Salesforce app) | ENV-DESKTOP-CHROME or EDGE |

## CALL-01 — five minutes, phrase heard, marker seen remotely (each pair)

1. Both: open the probe, tap the role button (TECH or SUPPORT), **Find MF-CASE-001** → must
   say "visible to you". Tap **Join MF-ROOM-001**. Accept OS/browser prompts when they appear
   (record which prompt, on which tap).
2. Both: **Unmute mic**, **Camera on** (marker in video: on). Start a stopwatch.
3. *Observe/record (each side):* the remote tile shows the other person's camera with a
   **yellow "TECH #n" / "SUPPORT #n" counter that keeps increasing**, and the receive row shows
   `changes/10 s` > 0. Write down one remote counter value you see and the time.
4. TECH reads the **test phrase** on screen aloud once. SUPPORT writes down exactly what they
   heard. Then SUPPORT reads it; TECH writes it down. *Human attests:* the words heard.
5. Keep the call up to **5:00** on the probe's timer (talk normally). Note any dropout, echo,
   freeze or one-way audio with the time.
6. At 5:00 both tap **Copy diagnostics** (the log contains the "5-minute mark" line).
7. If a side shows **Enable remote audio**, tap it and record that autoplay was blocked.

**PASS (per pair, per direction):** each side heard the other's phrase correctly, saw the
other's counter changing, and the call stayed joined for 5 minutes. **FAIL/PARTIAL:** say which
direction (e.g. "iOS → desktop audio OK, desktop → iOS audio silent" = one-way audio).

## CALL-02 — mute/unmute, camera toggle, join, leave (each pair; send and receive separately)

1. TECH taps **Mute mic** → SUPPORT's receive row shows audio `muted` and SUPPORT hears nothing;
   **Unmute** → audio `on` and heard again. Repeat with SUPPORT muting.
2. TECH taps **Camera off** → SUPPORT's tile goes blank / receive video `off`; **Camera on** →
   counter visible again. Repeat with SUPPORT.
3. TECH taps **Leave** → SUPPORT's remote list becomes empty within ~10 s; TECH's diagnostics
   "last leave" shows `all ended=true` and the OS camera/mic indicator turns off.
4. TECH taps **Join MF-ROOM-001** again → SUPPORT sees exactly **one** TECH tile (no duplicate).
5. Mobile only: lock the phone for 10 s and unlock; record what happens (finding for SMF-9).

Fill this table in the result file:

| Step | TECH send | TECH receive | SUPPORT send | SUPPORT receive |
|---|---|---|---|---|

## CALL-03 — on mobile only if time allows (desktop is automated)

1. As MF-RESTRICTED in the Salesforce app: open the probe, **Find MF-CASE-001** → must say
   "not visible"; Join stays disabled. Record the exact text.

Only a human can attest: the phrase heard, the counter seen on the remote tile, echo/one-way
audio, autoplay prompts, OS indicators, and anything on a physical phone.
