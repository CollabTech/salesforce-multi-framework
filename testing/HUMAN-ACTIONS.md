# Human-only actions

The one list of things only a person can do. Everything else is automated in the cloud
(`docs/cloud/WORKFLOW.md`). Each line names the case, the environment row, and the exact
interaction or observation. Results go in `testing/device-results/` (template there).

## One-time setup (owner)
- [ ] H1–H6 in `docs/cloud/HUMAN-SETUP.md` (network allowlist, Dev Hub auth URL with passkey,
      Dev Hub consent, Cloudflare token, tldraw key, tester mailbox).

## Device and observation actions
Story tracks append their items here as their probes land; ordering = run order.

| # | Case | Env rows | Who | Interaction / observation | Script |
|---|---|---|---|---|---|
| D1 | HOST-01, HOST-03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-TECH then MF-SUPPORT | Open "Field Support PoC" from the Salesforce app; confirm own name shows; navigate; pull-to-refresh; record app/OS versions and how the app opened | `docs/test-scripts/SMF-4-HOST.md` HOST-01 1–7 |
| D2 | HOST-02, HOST-03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-RESTRICTED (agent removes/restores access) | Confirm the app is not listed and a direct open is denied; record the exact message | `docs/test-scripts/SMF-4-HOST.md` HOST-02 1–3 |
| D3 | DATA-02 | ENV-SFMOBILE-IOS | Device tester as MF-TECH, MF-SUPPORT, then MF-RESTRICTED | In the Salesforce app (custom domain login; reset mail via `SMF_TESTER_EMAIL`): TECH/SUPPORT open MF-CASE-001 and preview MF-IMAGE-001; all three confirm MF-CASE-002 and MF-FILE-DENIED are denied (note exact message); RESTRICTED also denied MF-CASE-001/MF-IMAGE-001; record device, iOS and app versions | `docs/test-scripts/ENV-SFMOBILE-IOS.md` 1–9 (TECH, SUPPORT), 1–8 (RESTRICTED) |
| D4 | DATA-02 | ENV-SFMOBILE-ANDROID | Same as D3 | Same on a physical Android phone; also record Android System WebView version | `docs/test-scripts/ENV-SFMOBILE-ANDROID.md` same steps |
| D5 (optional, exploratory) | DATA-02 | ENV-MOBILE-SAFARI, ENV-MOBILE-CHROME | Device tester | Same steps in a private mobile-browser tab; never counts for the Salesforce app rows | `docs/test-scripts/ENV-MOBILE-SAFARI.md`, `ENV-MOBILE-CHROME.md` |
| D9 | CAP-01..03 | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE | Device tester as MF-TECH with a real webcam/mic | Attest the preview is the live camera and the meter follows speech; deny/cancel the real browser prompt then retry; unplug/disable a device; confirm the camera light/OS indicator turns off on leave (functional rows already automated, fake devices) | `docs/test-scripts/SMF-6-CAPTURE.md` CAP-01 2–4, CAP-02 1–2 and 4, CAP-03 2 |
| D10 | CAP-01..03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-TECH | Full CAP-01..03 in the Salesforce app: accept/deny the OS and in-app prompts as scripted; record camera and mic results separately; confirm the indicator turns off on leave | `docs/test-scripts/SMF-6-CAPTURE.md` all steps |
| D11 | CALL-01, CALL-02 | Pair A ENV-DESKTOP-CHROME↔ENV-DESKTOP-EDGE | Two testers with headsets: MF-TECH and MF-SUPPORT in separate browsers | 5-minute call: each says the test phrase and the other writes down what was heard; read the remote tile marker; mute/unmute and camera toggle observed on the far side; send and receive recorded separately | `docs/test-scripts/SMF-7-CALL.md` CALL-01, CALL-02 |
| D12 | CALL-01, CALL-02 | Pairs B/C ENV-SFMOBILE-IOS/ANDROID↔desktop | MF-TECH on the physical phone (Salesforce app), MF-SUPPORT on desktop | Same as D11 with the phone; also note OS prompts, speaker/earpiece routing, Wi-Fi vs cellular | same |
| D13 (if time) | CALL-03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | MF-RESTRICTED on the phone | Find MF-CASE-001 says "not visible" and Join stays disabled; record the exact text (desktop CALL-03 is automated) | `SMF-7-CALL.md` CALL-03 |
| D14 | SHARE-01, SHARE-03 | S1 ENV-DESKTOP-CHROME→ENV-DESKTOP-EDGE | MF-SUPPORT shares, MF-TECH receives | Use the real browser picker to share the synthetic diagnostic screen; receiver confirms the counter/clock/bar are moving; stop and restart; if screen audio is offered, say whether the tone is heard | `docs/test-scripts/SMF-8-SHARE.md` SHARE-01, SHARE-03 |
| D15 | SHARE-01, SHARE-02 | S2/S3 desktop→ENV-SFMOBILE-IOS/ANDROID (receive) | MF-TECH on the phone receives | Shared screen is readable on the phone; note fit/zoom | SHARE-01, SHARE-02 step 1 |
| D16 | SHARE-02 | S4/S5 ENV-SFMOBILE-IOS/ANDROID (originate) | MF-TECH on the phone shares | Record the Host observation line, tap Start screen share and record exactly what happens; send the static image instead and confirm the call continued and the image arrived | SHARE-02 steps 2–3 |

Desktop Edge (and Chrome once H1 allows it) rows for HOST-*, DATA-02 and the functional parts of CAP-*, CALL-* (CALL-03 fully) and desktop SHARE-* are automated in the cloud as the real personas.
