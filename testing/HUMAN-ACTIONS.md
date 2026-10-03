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
| D28 | FILE-01, FILE-04 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-TECH, then MF-SUPPORT | Upload MF-IMAGE-001 to MF-CASE-001 from the phone picker: see the "NOT persisted" preview, then the persisted panel (linked = true, key count 1, hash match); log in as SUPPORT and retrieve it (SHA prefix matches); record the picker type and whether a camera photo arrives as JPEG or is rejected as HEIC | `docs/test-scripts/SMF-10-FILES.md` FILE-01 1–7, FILE-04 |
| D29 | FILE-02 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-RESTRICTED, MF-TECH, MF-SUPPORT | Each denial attempt shows DENIED (RESTRICTED → the MF-CASE-001 File; TECH/SUPPORT → MF-FILE-DENIED and MF-CASE-002); record the exact text | FILE-02 1–2 |
| D30 | FILE-03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-TECH | Pick the .txt file and the >5 MiB image (both rejected); cancel mid-upload and retry; airplane mode mid-upload and retry; the File count rises by exactly 2 | FILE-03 1–5 |

Desktop Edge (and Chrome once H1 allows it) rows for HOST-* and DATA-02 are automated in the cloud as the real personas.
