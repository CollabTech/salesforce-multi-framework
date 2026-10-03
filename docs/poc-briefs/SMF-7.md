# POC-07 brief — Authorized RealtimeKit two-person audio and video (SMF-7)

- **Story:** [SMF-7](https://answersllc.atlassian.net/browse/SMF-7) (snapshot 2026-10-03) · **Dependencies:** SMF-3 (personas, MF-CASE-001/002), SMF-6 (capture) — neither verified in an org.
- **Case IDs:** CALL-01, CALL-02, CALL-03
- **Status:** TESTING (probe, Apex boundary, stages built; nothing executed against an org or Cloudflare) · **Capability outcome:** BLOCKED on every required row
- **Selected skills:** project `smf-story-workflow`, `smf-capability-probe`, `smf-salesforce-boundaries`, `smf-physical-mobile-testing`, `smf-evidence`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate`, `experience-ui-bundle-salesforce-data-access` (Apex REST via `sdk.fetch`, GraphQL case lookup), `experience-ui-bundle-metadata-generate` (CSP Trusted Sites), `platform-apex-generate`, `platform-apex-test-generate`, `platform-permission-set-generate`, `dx-code-analyzer-run`

## Question this probe answers
Can MF-TECH and MF-SUPPORT hold an authorized RealtimeKit call bound to MF-CASE-001 inside
Salesforce (desktop and physical mobile), with MF-RESTRICTED / wrong-case users and
invalid/expired authorization rejected server-side and no secret reaching the browser?

## Bounded scope
In: Apex token endpoint + room store + Named/External Credential + CMDT config + `SMF7_Access`;
probe `src/probes/smf-07-call/` (route `/probes/call`): case lookup, join/leave, mute, camera,
autoplay recovery, a changing marker composited into the outgoing video and decoded on the
receiving side, the fixed test phrase, 5-minute timer, send/receive table, negative controls
(invalid, tampered, previous/revoked token), copyable redacted diagnostics. Stages 45 (deploy +
readiness) and 53 (cloud e2e). Out: screen share (SMF-8), recovery measurements (SMF-9), UI Kit.

## Design
See `docs/smf-7/realtimekit-setup.md` (boundary, prerequisites, owner step, CSP hosts, limitation).

## Test plan per case ID
| Case ID | Personas | Fixtures | Environment rows | Executor | Expected | Stop conditions |
|---|---|---|---|---|---|---|
| CALL-01 | TECH + SUPPORT | MF-CASE-001, MF-ROOM-001 | pairs desktop↔desktop, desktop↔iOS, desktop↔Android | stage 53 (functional, fake devices) + humans (phrase heard, marker seen) | 5-min call; phrase heard both ways; marker changes seen remotely | stage 45 BLOCKED |
| CALL-02 | TECH + SUPPORT | MF-ROOM-001 | same pairs | stage 53 (desktop functional) + humans (mobile, audible/visible) | mute/camera/join/leave work; send and receive recorded separately | — |
| CALL-03 | RESTRICTED, TECH/SUPPORT (wrong case), TECH (tokens) | MF-CASE-001/002, MF-ROOM-001/002, invalid/tampered/revoked token | desktop automated | stage 53 + Apex tests | denied without token; tokens rejected once; nothing leaked | expired variant: C-SMF7-1 |

## Prerequisites and blockers (smallest unblocking action)
- Org/personas/app: SMF-2 ENV-01..03 BLOCKED → HUMAN-SETUP H1 + H2, then stages 20/30/40.
- Cloudflare: HUMAN-SETUP H4 (`CF_ACCOUNT_ID`, `CF_API_TOKEN` with Realtime: Edit); egress to
  `api.cloudflare.com`, `*.realtime.cloudflare.com`, `stun.cloudflare.com`, `turn.cloudflare.com`.
- Owner step O-SMF7-1 (org-side token), detected by stage 45.
- Devices: physical iPhone and Android phone with the Salesforce app; two people.
- "Expired" authorization: C-SMF7-1 (owner decision).

## Licensing / cost
`@cloudflare/realtimekit` 2.0.2 Apache-2.0. Usage $0.002 per A/V participant-minute (docs,
2026-10-03); estimated test cost ≈ $1 for SMF-7/8/9 combined.

## Results
`evidence/SMF-7/CALL-0n.md` (required rows, BLOCKED); `CALL-03-ENV-EMULATION-LOCALHOST.md`
(stubbed endpoint, client handling only). Apex tests (18 methods) are written but could not
run (no org); Code Analyzer results are in the CALL-03 record's notes.
