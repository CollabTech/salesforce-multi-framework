# POC-09 brief — Call recovery during mobile and network interruptions (SMF-9)

- **Story:** [SMF-9](https://answersllc.atlassian.net/browse/SMF-9) (snapshot 2026-10-03) · **Dependencies:** SMF-7 (call) — built, not executed (BLOCKED).
- **Case IDs:** REC-01, REC-02, REC-03
- **Status:** TESTING (probe and scripts built; device runs pending) · **Capability outcome:** BLOCKED on every required row
- **Selected skills:** project `smf-story-workflow`, `smf-capability-probe`, `smf-physical-mobile-testing`, `smf-evidence`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate`

## Question
After network loss/switch, background/foreground, lock/unlock and an incoming call on a
physical phone in the Salesforce app, does the call recover, how fast, with A/V restored,
without duplicate participants or orphaned local tracks — and when it does not, what manual
recovery works?

## Bounded scope
In: `src/probes/smf-09-recovery/` (route `/probes/recovery`): the SMF-7 call with a recovery
panel (connection/participant state, timestamped timeline of browser signals — online/offline,
visibility, pagehide/pageshow, freeze/resume — and SDK socket/media states, automatic episode
detection with detect/recover times, duplicate-participant detection incl. 10 s after recovery,
gesture-needed flag from local tracks, scenario × run labelling, min/median/max, copyable log);
REC-03 uses the SMF-7 leave (local tracks stopped, `all ended`) and rejoin (participant reused
server-side → no duplicate). A clearly labelled **simulated transport** mode exercises the panel
logic without a call. Out: changing the SDK's reconnect policy; any background-capture claim.

## Test plan per case ID
| Case | Personas | Rows | Executor | Expected |
|---|---|---|---|---|
| REC-01 | TECH (phone) + SUPPORT (desktop) | SFMOBILE-IOS/ANDROID; desktop network loss automated | humans (phone, 3× loss, 3× switch); stage 55 (desktop loss ×3) | detection, recovery time, A/V restored, duplicates recorded per run |
| REC-02 | same | SFMOBILE-IOS/ANDROID | humans only | 3× background, 3× lock, incoming call where feasible |
| REC-03 | same | phone + desktop | humans; stage 55 (desktop ×3) | leave stops local media; rejoin recovers, no duplicate |

## Prerequisites and blockers
SMF-7 prerequisites (H1, H2, H4, O-SMF7-1, stages 20–45); physical iPhone and Android with the
Salesforce app and a SIM (Wi-Fi↔cellular); a third phone to place the incoming call.

## Licensing / cost
No new dependency; RealtimeKit minutes as SMF-7.

## Results
`evidence/SMF-9/REC-0n.md` (BLOCKED); `REC-0n-ENV-EMULATION-LOCALHOST.md` (simulated transport
logic only).
