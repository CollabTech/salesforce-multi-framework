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
| D6 (supplementary) | PKG-01 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-TECH then MF-SUPPORT in the install-test org | Open "Field Support PoC"; own name shows; Probes → Package version marker reads **v1 (1.0.0)**; record versions and how the app opened | `docs/test-scripts/SMF-5-PKG.md` PKG-01 1–5 |
| D7 (supplementary) | PKG-02 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Same, after the agent upgrades to v2 | Marker reads **v2 (1.1.0)** without re-assignment; note any stale page/refresh; MF-CASE-001 and its image still visible | `docs/test-scripts/SMF-5-PKG.md` PKG-02 1–4 |
| D8 (supplementary) | PKG-03 | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID | Device tester as MF-RESTRICTED (agent removes/restores access) | App not listed and direct open denied (exact message); listed again after restore | `docs/test-scripts/SMF-5-PKG.md` PKG-03 2–4 |

Desktop Edge (and Chrome once H1 allows it) rows for HOST-*, DATA-02 and PKG-* are automated in the cloud as the real personas.
