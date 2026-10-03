# CAP-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows) — required host rows

| Field | Value |
|---|---|
| Case ID | CAP-01 |
| Story | SMF-6 |
| Persona pair | MF-TECH (capture); Brandon/device tester for permission prompts |
| Fixture IDs / hash / version | MF-ASSET-001 context + synthetic pump scene (contract 1.0.0); not provisioned |
| Build / commit | branch claude/smf-6-capture (probe src/probes/smf-06-capture, base 7d6b5ea); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host could be reached |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows) |
| Timestamp | 2026-10-03T22:10:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore SMF-3 MF-TECH is not provisioned/verified and the SMF-4 app (with this probe) is not deployed in any org. No physical iOS/Android device and no desktop Chrome/Edge session inside Salesforce are available to the agent. |
| Steps | Not executed. Script prepared: docs/test-scripts/SMF-6-CAPTURE.md (CAP-01). |
| Expected result | From a user gesture, test camera-only, mic-only, and combined capture; verify actual tracks and preview/input activity. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-6-CAPTURE.md; docs/poc-briefs/SMF-6.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking action: (1) owner completes docs/cloud/HUMAN-SETUP.md H1 (network allowlist) and H2 (SF_AUTH_URL_DEVHUB), complete SMF-3 DATA-01..03 and SMF-4 HOST-01; (2) deploy branch claude/smf-6-capture per docs/smf-4/deploy.md; (3) agent runs scripts/cloud/stages/52-smf6-capture-e2e.sh (desktop Edge/Chromium, fake devices, functional rows); (4) Brandon: run docs/test-scripts/SMF-6-CAPTURE.md steps for CAP-01 as MF-TECH on desktop Chrome, desktop Edge, a physical iPhone (iOS 18+) in the Salesforce app and a physical Android phone (12+) in the Salesforce app, accepting/denying the OS/browser prompts as scripted and recording camera and mic results separately. |

Per-row results (camera and mic recorded separately, SMF-6 AC4):

| Env row | Camera | Mic | Executor once unblocked | Reason |
|---|---|---|---|---|
| ENV-DESKTOP-CHROME | BLOCKED | BLOCKED | agent: cloud automated functional check with fake devices (needs H1 dl.google.com for branded Chrome) + human: real camera/mic observation | no org / app not deployed; no persona session (H1/H2 pending) |
| ENV-DESKTOP-EDGE | BLOCKED | BLOCKED | agent: cloud automated functional check with fake devices (stage 51) + human: real camera/mic observation | no org / app not deployed; no persona session (H1/H2 pending) |
| ENV-SFMOBILE-IOS | BLOCKED | BLOCKED | human only (physical iPhone, Salesforce app) | no org / app not deployed; no physical device |
| ENV-SFMOBILE-ANDROID | BLOCKED | BLOCKED | human only (physical Android, Salesforce app) | no org / app not deployed; no physical device |
| ENV-MOBILE-SAFARI / ENV-MOBILE-CHROME (exploratory) | NOT TESTED | NOT TESTED | human (exploratory) | no device |

Cloud fake-device runs attest probe logic and track lifecycle inside the real host only; they never attest a real camera/mic, the preview showing the scene, or the meter following speech.

Localhost exploratory runs are separate records (CAP-01-ENV-EMULATION-LOCALHOST.md) and do not change these rows.
