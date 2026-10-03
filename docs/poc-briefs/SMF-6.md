# POC-06 brief — Camera and microphone capture inside each Salesforce host (SMF-6)

- **Story:** [SMF-6](https://answersllc.atlassian.net/browse/SMF-6) (snapshot 2026-10-03) · **Dependencies:** SMF-4 (app launches in the host) — not yet verified in any org.
- **Case IDs:** CAP-01, CAP-02, CAP-03
- **Status:** TESTING (probe built; host runs pending) · **Capability outcome:** BLOCKED on every required row
- **Selected skills:** project `smf-story-workflow`, `smf-capability-probe`, `smf-evidence`, `smf-physical-mobile-testing`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate` (rules + `verify-rules.mjs`)

## Question this probe answers
Can MF-TECH start camera-only, mic-only and combined capture from a gesture inside desktop
Salesforce and the physical Salesforce mobile app, see the real outcome of denials and
missing devices, switch devices, and have every track stop on leave?

## Bounded scope
In: `uiBundles/FieldSupport/src/probes/smf-06-capture/` (route `/probes/capture`) — buttons
per mode, track table (kind, label, readyState, enabled/muted, settings without device IDs),
video preview with frame counter, mic level meter (Web Audio RMS, peak), device selectors
(`enumerateDevices`, switch = acquire new then stop old), simulated unavailable device
(`deviceId: {exact: <non-existent>}`), explicit error mapping (NotAllowed, NotFound,
NotReadable, Overconstrained, Security, Abort, TypeError, API missing), host observations
(secure context, framed, `document.permissionsPolicy`/`featurePolicy`, Permissions API state),
stop-all on Stop / leave (unmount) / `pagehide`, and a copyable diagnostics block.
Out: transmitting media (SMF-7), screen capture (SMF-8), recording or upload of any media.

## Test plan per case ID
| Case ID | Personas | Fixtures | Environment rows | Steps (summary) | Expected | Stop conditions |
|---|---|---|---|---|---|---|
| CAP-01 | MF-TECH; tester handles prompts | MF-ASSET-001 scene | DESKTOP-CHROME, DESKTOP-EDGE, SFMOBILE-IOS, SFMOBILE-ANDROID | `docs/test-scripts/SMF-6-CAPTURE.md` CAP-01 | Camera-only, mic-only, combined each give live tracks with observed activity; camera and mic recorded separately | App not launchable in the row (SMF-4) → BLOCKED |
| CAP-02 | as above | as above | as above | deny/cancel, retry, simulated + real unavailable device, switch | UI reports the real outcome each time; retry works after granting | Device lacks a second camera/mic → "not offered" |
| CAP-03 | as above | as above | as above | leave / stop / host navigation | All tracks `ended`, OS indicator off; camera and mic recorded separately | — |

## Prerequisites and blockers
- **All CAP rows:** SMF-2 ENV-01..03 BLOCKED (no org credential; environment egress to
  Salesforce denied) → SMF-3 personas and SMF-4 deployment unverified. Smallest unblocking
  action: complete SMF-2/3/4 (see their briefs), deploy this branch with
  `docs/smf-4/deploy.md`, then Brandon runs `docs/test-scripts/SMF-6-CAPTURE.md`.
- **Mobile rows:** a physical iPhone (iOS 18+) and Android phone (12+, WebView 90+) with the
  Salesforce app; none available to the agent.
- **Host limitations to check on device (not assumed):** whether the Salesforce mobile
  container exposes `getUserMedia` to the UI bundle, which prompt (OS vs. app vs. web view)
  appears, whether the bundle is framed and what the Permissions-Policy reports for
  `camera`/`microphone`, and whether background/lock stops capture. The probe records these.

## Cloud-first execution (owner direction 2026-10-03)
Desktop rows: functional checks automated by `scripts/cloud/stages/51-smf6-capture-e2e.sh`
(`testing/cloud-e2e/tests/smf-6-capture.spec.ts`; MF-TECH via `personaContext`; Edge + Chromium,
fake devices; deny→grant→retry via a second browser launched with `--deny-permission-prompts`).
They attest probe logic, host framing/policy and track lifecycle only. Real camera/mic,
observed preview/meter, OS prompts/indicators and both mobile rows are human (HUMAN-ACTIONS).

## Licensing / cost
No new dependency, no paid service.

## Results
- Required rows: `evidence/SMF-6/CAP-01.md`, `CAP-02.md`, `CAP-03.md` — BLOCKED.
- Localhost exploratory (Chromium fake devices; not host evidence):
  `evidence/SMF-6/CAP-0n-ENV-EMULATION-LOCALHOST.md`.
- Limitation: Chromium fake devices prove the probe's logic only; they say nothing about the
  Salesforce hosts, real prompts, or real hardware.
