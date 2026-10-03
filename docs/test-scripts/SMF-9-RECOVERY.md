# SMF-9 REC-01..03 — device interruption scripts (physical Salesforce mobile + desktop)

**Who:** the device tester holds the phone (MF-TECH); a second person on desktop is MF-SUPPORT.
**Room:** MF-ROOM-001. **App:** Capability probes → *SMF-9 · Call recovery* → **Real call**
(the *Simulated transport* button is a logic check only — never use it for these runs).
**Fixed synthetic A/V script** (repeat after every interruption to check A/V is restored):
TECH reads the SMF-7 test phrase; SUPPORT confirms heard; both read the other's tile counter.
**Preconditions:** SMF-7 CALL-01 passes in the same pair (stage 45 OK, O-SMF7-1 done).

Rows: ENV-SFMOBILE-IOS and ENV-SFMOBILE-ANDROID (physical phone, Salesforce app) ↔ desktop.
Desktop network loss and leave/rejoin are also automated in stage 55 (fake devices).

## Before every run
1. Both join MF-ROOM-001 (SMF-7 script steps 1–2), mic and camera on; TECH's tile counter is
   visible to SUPPORT and vice versa.
2. On the phone, in the *SMF-9 · Interruption and recovery* card: choose the **Scenario** and
   **Run 1/2/3**. Tap **Mark interruption start now** immediately before the interruption.
3. SUPPORT notes the wall-clock time they first notice frozen/missing TECH media.

## After every run
4. Wait up to **60 s** for automatic recovery (probe shows `socket=connected`, `remotes=1`,
   TECH's counter moving again at SUPPORT). If it does not recover, tap **Automatic recovery
   failed — close episode**, then recover manually (Leave → Join MF-ROOM-001) and record the
   manual steps and time.
5. Run the fixed A/V script; record whether audio and video came back in **each direction**,
   whether a tap was needed (e.g. "Enable remote audio", camera re-enable, OS prompt again).
6. SUPPORT records whether TECH appears **once** (duplicate = two TECH tiles).
7. Tap **Copy recovery log** on the phone and paste it into the result file (the episodes table
   holds start time, detection and recovery times, max remotes, duplicates, gesture flag).

## REC-01 — network (three runs each, per phone)
| Scenario | Exact interruption |
|---|---|
| Network loss / recovery | Control Centre / quick settings → **Airplane mode ON**, wait **20 s**, **OFF**. |
| Network switch Wi-Fi ↔ cellular | Start on Wi-Fi. Turn **Wi-Fi OFF** (stay on cellular) for 60 s, then **Wi-Fi ON** (back to Wi-Fi). Counts as one run; record both transitions. |

## REC-02 — app/OS interruptions (three runs each, per phone)
| Scenario | Exact interruption |
|---|---|
| App background / foreground | Swipe to the home screen (Salesforce app backgrounded) for **15 s**, reopen the Salesforce app. |
| Screen lock / unlock | Press the side/power button (lock) for **15 s**, unlock. |
| Incoming phone call (where feasible) | From a third phone, call the test phone; let it ring 10 s, **decline**; on run 2 **accept**, talk 10 s, hang up. If no third phone/SIM: record **BLOCKED (no caller)**. |

Record whether capture continued in the background — **the PoC makes no claim of
uninterrupted background capture**; observed behaviour is reported as-is (PARTIAL/FAIL allowed).

## REC-03 — explicit leave/rejoin (three runs, phone and desktop)
1. TECH taps **Leave**. *Observe:* the OS camera/mic indicator turns off; *Last leave* shows
   `all ended=true`; SUPPORT's remote list becomes empty.
2. TECH taps **Join MF-ROOM-001**. SUPPORT sees exactly **one** TECH tile; A/V script passes.
3. Also once: **Rejoin with previous token** after Leave — record whether it joins (token
   still valid) and whether a duplicate appears.

## Results table template (one per phone; copy into `testing/device-results/`)

| Scenario | Run | Interruption start (UTC) | Disconnect detected (probe, ms) | SUPPORT noticed at | Recovered after (ms) / manual | A/V restored TECH→SUP | A/V restored SUP→TECH | Gesture/permission again? | Duplicate TECH? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Network loss | 1 | | | | | | | | | |
| Network loss | 2 | | | | | | | | | |
| Network loss | 3 | | | | | | | | | |
| Wi-Fi ↔ cellular | 1–3 | | | | | | | | | |
| Background/foreground | 1–3 | | | | | | | | | |
| Lock/unlock | 1–3 | | | | | | | | | |
| Incoming call | 1–3 | | | | | | | | | |
| Leave/rejoin | 1–3 | | | | | | | | | |

Variability: report min / median / max recovery per scenario (the probe prints them). Any
interruption not performed stays **BLOCKED / NOT TESTED** with the reason.
Only a human can attest: audio heard and video seen after recovery, OS indicators, prompts, and
everything on the phone.
