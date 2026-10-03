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

Desktop Edge (and Chrome once H1 allows it) HOST rows are automated in the cloud.
