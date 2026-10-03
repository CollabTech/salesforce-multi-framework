# POC-08 brief — Screen sharing and graceful unsupported behaviour (SMF-8)

- **Story:** [SMF-8](https://answersllc.atlassian.net/browse/SMF-8) (snapshot 2026-10-03) · **Dependencies:** SMF-7 (call) — built, not executed (BLOCKED).
- **Case IDs:** SHARE-01, SHARE-02, SHARE-03
- **Status:** TESTING (probe built; host runs pending) · **Capability outcome:** BLOCKED on every required row
- **Selected skills:** project `smf-story-workflow`, `smf-capability-probe`, `smf-physical-mobile-testing`, `smf-evidence`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate`

## Question
Can MF-SUPPORT share a diagnostic screen to MF-TECH (and the reverse where offered) inside the
Salesforce hosts, with cancel/unsupported paths explained, the call preserved and a static
image fallback, and screen audio tested only as a separate optional capability?

## Bounded scope
In: `src/probes/smf-08-share/` (route `/probes/share`: the SMF-7 call + a share panel via the
`Extension` slot), `src/probes/smf-08-diagnostic-screen/` (route `/probes/diagnostic-screen`),
RealtimeKit `enableScreenShare/disableScreenShare` (the SDK calls getDisplayMedia), a local
getDisplayMedia test path without a call, host detection (getDisplayMedia, Permissions-Policy
`display-capture`, framed, mobile UA), outcome mapping (cancel/deny, unsupported, not a gesture,
aborted), static-image fallback sent as video, screen-audio reported as captured or not, receive
side frames + decoded marker. Out: recovery (SMF-9), annotation of shared screens (SMF-11/12).

## Test plan per case ID
| Case | Personas | Fixtures | Rows | Executor | Expected |
|---|---|---|---|---|---|
| SHARE-01 | SUPPORT → TECH (reverse where offered) | MF-ROOM-001, diagnostic screen | desktop S1; desktop→mobile S2/S3 | stage 53 (desktop functional) + humans (seen) | start from gesture, changing screen seen, stop, restart |
| SHARE-02 | same | + fallback image | S2–S5 | humans (mobile), stage 53 (desktop cancel stub) | mobile receive vs originate separate; cancel/unsupported keeps call + fallback |
| SHARE-03 | same | tone tab | S1 | humans | screen audio only if offered; heard |

## Prerequisites and blockers
All SMF-7 prerequisites (H1, H2, H4, O-SMF7-1, stages 20–45) + physical iPhone/Android +
two testers. The preset must permit screen share (`group_call_host` default; checked in stage 45
only for existence, not permissions — verify on first run). **MF-IMAGE-001 asset not available
on this branch**: a placeholder marked "not MF-IMAGE-001" fills the fallback slot; swap it for
the SMF-3 asset (smallest action: copy the approved PNG/JPEG into `src/probes/smf-08-share/` and
change the import).

## Licensing / cost
No new dependency. Screen-share minutes are billed as RealtimeKit participant minutes (SMF-7).

## Results
`evidence/SMF-8/SHARE-0n.md` (BLOCKED); `SHARE-0n-ENV-EMULATION-LOCALHOST.md` (local path only).
Harness finding: headless Chromium `--deny-permission-prompts` leaves getDisplayMedia pending
(no picker), so cancel/deny is stubbed in automation and must be done by a person for real.
