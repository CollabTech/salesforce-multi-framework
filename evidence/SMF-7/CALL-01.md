# CALL-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows; mobile rows via desktop↔mobile pairs) — required pairs

| Field | Value |
|---|---|
| Case ID | CALL-01 |
| Story | SMF-7 |
| Persona pair | MF-TECH + MF-SUPPORT (independent simultaneous sessions) |
| Fixture IDs / hash / version | MF-CASE-001, MF-ROOM-001 (contract 1.0.0); not provisioned |
| Build / commit | branch claude/smf-7-call (probe src/probes/smf-07-call, Apex SMF7_*, stages 45/52); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host or Cloudflare service reachable |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows; mobile rows via desktop↔mobile pairs) |
| Timestamp | 2026-10-03T22:35:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied → SMF-3 personas/fixtures (MF-TECH, MF-SUPPORT, MF-RESTRICTED, MF-CASE-001/002) unverified, app not deployed. Cloudflare: no account/token (CF_ACCOUNT_ID/CF_API_TOKEN unset) and api.cloudflare.com blocked by the environment proxy. Agent run of the stage-45 helper at 2026-10-03T22:30Z: `python3 scripts/cloud/smf7_realtimekit.py prepare` → 'BLOCKED: CF_ACCOUNT_ID / CF_API_TOKEN not set (HUMAN-SETUP H4)', exit 2. No physical devices. |
| Steps | Not executed. Automated part: testing/cloud-e2e/tests/smf-7-call.spec.ts (stage 53). Human part: docs/test-scripts/SMF-7-CALL.md CALL-01 steps 1–7 per pair. |
| Expected result | TECH/SUPPORT join MF-ROOM-001 for five minutes; each reads a short test phrase heard by the other and displays a changing visual marker visible remotely. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-7-CALL.md; docs/smf-7/realtimekit-setup.md; docs/poc-briefs/SMF-7.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking actions: (1) owner: docs/cloud/HUMAN-SETUP.md H1 (allowlist incl. api.cloudflare.com, *.realtime.cloudflare.com; plus stun.cloudflare.com/turn.cloudflare.com for media), H2 (SF_AUTH_URL_DEVHUB), H4 (CF_ACCOUNT_ID, CF_API_TOKEN with Realtime: Edit); (2) agent: stages 20, 30, 40, 45; (3) owner: O-SMF7-1 in docs/smf-7/realtimekit-setup.md (set ApiToken on External Credential SMF7_Cloudflare / principal SMF7_Principal in Setup) — stage 45 detects it; (4) agent: stage 53 (desktop functional rows); (5) humans: docs/test-scripts/SMF-7-CALL.md CALL-01 steps 1–7 for pairs A (Chrome↔Edge), B (desktop↔physical iPhone), C (desktop↔physical Android), two testers with headsets |

Per-pair results (send and receive recorded separately, SMF-7 AC4):

| Pair | Direction | Outcome | Executor once unblocked |
|---|---|---|---|
| desktop↔desktop (Chrome↔Edge) | TECH→SUPPORT | BLOCKED | agent stage 53 functional (fake devices) + humans: heard/seen |
| desktop↔desktop (Chrome↔Edge) | SUPPORT→TECH | BLOCKED | same |
| desktop↔ENV-SFMOBILE-IOS | desktop→iOS | BLOCKED | humans only (physical iPhone, Salesforce app) |
| desktop↔ENV-SFMOBILE-IOS | iOS→desktop | BLOCKED | humans only |
| desktop↔ENV-SFMOBILE-ANDROID | desktop→Android | BLOCKED | humans only (physical Android, Salesforce app) |
| desktop↔ENV-SFMOBILE-ANDROID | Android→desktop | BLOCKED | humans only |

Fake-device cloud runs attest media transport and state propagation only, never audio heard or video seen.
