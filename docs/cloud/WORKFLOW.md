# Cloud workflow

The project is built, provisioned, deployed, packaged, tested and evidenced from Claude Code
cloud sessions. Humans do the one-time setup in `HUMAN-SETUP.md` and the device/observation
actions in `testing/HUMAN-ACTIONS.md`; nothing else waits on a local machine.

```
session start ─► bash scripts/cloud/session-setup.sh  (sf CLI, skills, Microsoft Edge, deps,
                                                    Dev Hub login + vault restore)
             ─► scripts/cloud/pipeline.sh all      (stages/NN-*.sh, in order)
                  10 readiness  SMF-2  ENV-01..03 report
                  20 orgs       SMF-2  scratch orgs smf-dev / smf-install-test, vault save
                  30 provision  SMF-3  personas, grants, fixtures, access checks (DATA-*)
                  40 deploy     SMF-4  build + deploy app, app permission baseline
                  5x cloud-e2e  SMF-4+ Playwright as real personas in Edge/Chromium
                  60 package    SMF-5  unlocked 2GP v1/v2 → smf-install-test
                  90 matrix     SMF-3  evidence + capability matrix regeneration
             ─► commit evidence/matrix, update Jira, push PR
device tester ─► testing/device-results/*.md  ─► ingested by the agent next session
```

## What the cloud environment can and cannot do (verified 2026-10-03)

| Capability | Status in this environment | Notes |
|---|---|---|
| Salesforce CLI | **Installed by setup** (npm) | v2.152.14 verified |
| Official skills | **Installed by setup** (pinned, verified) | `bootstrap-skills.py` |
| Playwright Chromium | **Available** (preinstalled 141.0.7390.37) | Separate row `ENV-CLOUD-CHROMIUM`; never fills `ENV-DESKTOP-CHROME` |
| Microsoft Edge (official build) | **Installable — verified** 154.0.4258.53 from packages.microsoft.com | Real Microsoft Edge on Linux → `ENV-DESKTOP-EDGE` for automated (non-A/V) checks; record "Linux" as the OS |
| Google Chrome (branded) | **Installable only after H1 allows dl.google.com** | Until then `ENV-DESKTOP-CHROME` automated runs are BLOCKED |
| Headed browser | **Available** (Xvfb, `xvfb-run`) | Pipeline runs headed under Xvfb |
| Camera/mic in browsers | **Fake devices only** (`--use-fake-device-for-media-stream`) | Proves code paths and track lifecycle; never camera/mic/A-V capability on a host |
| WebGL | **Software only** (SwiftShader) | Functional 3D checks; performance numbers are not device evidence |
| Reaching Salesforce / Cloudflare / tldraw | **Blocked until H1** | Egress proxy denies these hosts today |
| Org credentials | **Missing until H2** | One secret; the rest via the vault (ADR-0004) |
| Physical Salesforce mobile (iOS/Android) | **Not available in any cloud** | Human-only (`testing/HUMAN-ACTIONS.md`) |
| Observed audio/video quality, permission prompts on device | **Not automatable** | Human-only |

Browser automation runs as the persona through a frontdoor URL minted from that persona's
own CLI session (`sf org open --url-only`); the URL is never logged, and traces/screenshots
go to `private/` until reviewed. Admin sessions are used only for setup and toggles.

## Feedback loop for device tests

1. The pipeline marks every human-only matrix cell with the exact script and step numbers.
2. The tester follows `testing/HUMAN-ACTIONS.md`, fills `testing/device-results/TEMPLATE.md`
   (GitHub web editor or in the Claude app), and commits it to the story branch.
3. The next cloud session ingests new device results, checks them against the case's
   expected result and build, writes `evidence/SMF-n/<CASE>-<ENV-ROW>.md`, regenerates the
   matrix, and updates Jira. Disagreements go back to the tester as a named question.
