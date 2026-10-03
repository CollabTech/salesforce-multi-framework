# Per-environment test scripts

Human-run scripts, one per environment row (SMF-3 DATA-04). They name exact actions and what to record. Results go in `testing/device-results/` (template there); the agent writes the evidence record and updates `testing/MATRIX.md`. Automated counterparts run in the cloud (`docs/cloud/WORKFLOW.md`).

| Environment row | Script | Covers | Automated counterpart |
|---|---|---|---|
| `ENV-DESKTOP-CHROME` (required) | [ENV-DESKTOP-CHROME.md](ENV-DESKTOP-CHROME.md) | DATA-02 persona login + access | stage 51 (`testing/cloud-e2e/tests/smf-3-access.spec.ts`) |
| `ENV-DESKTOP-EDGE` (required) | [ENV-DESKTOP-EDGE.md](ENV-DESKTOP-EDGE.md) | DATA-02 persona login + access | stage 51 (`testing/cloud-e2e/tests/smf-3-access.spec.ts`) |
| `ENV-SFMOBILE-IOS` (required) | [ENV-SFMOBILE-IOS.md](ENV-SFMOBILE-IOS.md) | DATA-02 persona login + access | none (human-only row) |
| `ENV-SFMOBILE-ANDROID` (required) | [ENV-SFMOBILE-ANDROID.md](ENV-SFMOBILE-ANDROID.md) | DATA-02 persona login + access | none (human-only row) |
| `ENV-MOBILE-SAFARI` (exploratory) | [ENV-MOBILE-SAFARI.md](ENV-MOBILE-SAFARI.md) | DATA-02 persona login + access | none (human-only row) |
| `ENV-MOBILE-CHROME` (exploratory) | [ENV-MOBILE-CHROME.md](ENV-MOBILE-CHROME.md) | DATA-02 persona login + access | none (human-only row) |

`ENV-CLOUD-CHROMIUM` and `ENV-EMULATION-LOCALHOST` are agent-only rows with no human script. Org-level DATA-02 checks (no host) run in stages 33/34. Later stories add their own scripts here (e.g. `SMF-4-HOST.md`).
