# SMF-8 SHARE-01..03 — human-run script (screen share by direction and host)

**Who:** two testers. **Personas:** MF-SUPPORT shares first, MF-TECH receives; then reverse
where the host offers sharing. **Room:** MF-ROOM-001. **App:** Capability probes → *SMF-8 ·
Screen share in the call* (the SMF-7 call with a screen-share panel). **Diagnostic screen:**
*SMF-8 · Synthetic diagnostic screen* (route `/probes/diagnostic-screen`), a full-screen
canvas with a pump trend, a sweeping bar, a clock and a counter strip that changes every 0.5 s.
**Fallback image:** the panel's static image — currently a **placeholder clearly marked "not
MF-IMAGE-001"** until SMF-3 publishes the approved asset; record which image was shown.

**Preconditions:** SMF-7 CALL-01 works in the same pair (stage 45 OK, O-SMF7-1 done).
**Cloud-first split:** stage 54 automates desktop start/stop/restart, receive frames, cancel
(stubbed) and fallback with fake capture. People do: real picker interactions, *seeing* the
diagnostic screen, screen audio *heard*, and every mobile row. Results go in
`testing/device-results/`.

Rows (each direction separately — do not infer mobile sharing from mobile viewing):

| Row | Sharer | Receiver |
|---|---|---|
| S1 | SUPPORT desktop Chrome | TECH desktop Edge |
| S2 | SUPPORT desktop (Chrome/Edge) | TECH **ENV-SFMOBILE-IOS** (receive) |
| S3 | SUPPORT desktop | TECH **ENV-SFMOBILE-ANDROID** (receive) |
| S4 | TECH **ENV-SFMOBILE-IOS** (originate) | SUPPORT desktop |
| S5 | TECH **ENV-SFMOBILE-ANDROID** (originate) | SUPPORT desktop |

## SHARE-01 — start from a gesture, other side sees the changing screen, stop, restart (S1–S3)

1. Both join MF-ROOM-001 (SMF-7 script steps 1–2). Sharer opens **Open diagnostic screen**
   (new tab/window) and keeps it visible.
2. Sharer taps **Start screen share**; in the browser picker choose the *SMF Diagnostic Screen*
   tab or its window. *Record:* picker type and options offered (tab/window/screen, "share
   audio" checkbox present or not).
3. Receiver: a *Received screens* tile appears. *Human attests:* the counter/clock/sweeping bar
   are visibly changing; note one counter value seen and the time; record
   `frames … · marker … · changes/10 s …` (marker decoding works when a full tab is shared).
4. Sharer taps **Stop screen share** (also try the browser's own "Stop sharing" bar once).
   Receiver: tile disappears within ~10 s; call audio/video continue.
5. Sharer taps **Restart screen share** and repeats step 3.

**PASS:** receiver saw the live diagnostic screen after start and after restart, and the stop
removed it while the call stayed up.

## SHARE-02 — mobile receive vs mobile originate; cancel/unsupported keeps the call (S2–S5)

1. S2/S3: run SHARE-01 with the phone as receiver. *Human attests* the screen is readable on the
   phone; record whether it fits/zooms.
2. S4/S5: on the phone, open the probe. *Record* the "Host observation" line (verdict,
   getDisplayMedia, policy, framed). Tap **Start screen share**. Record exactly what happens
   (no picker / OS sheet / error code). Expected on iOS/Android Salesforce app: unsupported
   (`unsupported-api` or a `NOT_SUPPORTED`/`CANCELLED_OR_DENIED` code) — **record what actually
   happens**; a visible button is not success.
3. Whenever sharing is unavailable or you cancel the picker (desktop: press *Cancel*):
   *Observe* the red outcome box, the static image shown, and that the call continues (talk,
   see video). Tap **Send static image instead** → the other side sees the image with an
   "IMAGE #n" counter. Record which image was used (placeholder vs MF-IMAGE-001).

**PASS:** mobile receive and mobile originate are recorded as separate results; every
cancel/unsupported path showed a clear explanation, the fallback image, and an unaffected call.

## SHARE-03 — screen audio, only if offered (S1, desktop)

1. In the picker, if a "Share tab audio" / "Share system audio" option exists, enable it and
   share a tab playing a synthetic tone (e.g. an online tone-generator tab you control).
2. Receiver: *Human attests* whether the tone is heard; the receiver tile shows
   `screen audio live` or `none`.
3. Local test without a call: tick **Request screen audio**, **Start local share test**;
   record `audio …` shown.
4. If no audio option is offered: record **"not offered"** with the browser and picker type.

**PASS** only if audio was offered, selected, and heard. Not offered = recorded as not offered
(not PASS, not FAIL). Do not count a checkbox as success.

Only a human can attest: seeing the diagnostic screen, picker/OS behaviour, screen audio heard,
and anything on a phone.
