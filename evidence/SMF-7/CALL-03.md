# CALL-03 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows; mobile rows via desktop↔mobile pairs) — authorization boundary

| Field | Value |
|---|---|
| Case ID | CALL-03 |
| Story | SMF-7 |
| Persona pair | MF-RESTRICTED; MF-TECH and MF-SUPPORT against MF-CASE-002; MF-TECH for token controls |
| Fixture IDs / hash / version | MF-CASE-001, MF-CASE-002, MF-ROOM-001, MF-ROOM-002, invalid / tampered / revoked token; not provisioned |
| Build / commit | branch claude/smf-7-call (probe src/probes/smf-07-call, Apex SMF7_*, stages 45/52); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host or Cloudflare service reachable |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows; mobile rows via desktop↔mobile pairs) |
| Timestamp | 2026-10-03T22:35:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied → SMF-3 personas/fixtures (MF-TECH, MF-SUPPORT, MF-RESTRICTED, MF-CASE-001/002) unverified, app not deployed. Cloudflare: no account/token (CF_ACCOUNT_ID/CF_API_TOKEN unset) and api.cloudflare.com blocked by the environment proxy. Agent run of the stage-45 helper at 2026-10-03T22:30Z: `python3 scripts/cloud/smf7_realtimekit.py prepare` → 'BLOCKED: CF_ACCOUNT_ID / CF_API_TOKEN not set (HUMAN-SETUP H4)', exit 2. No physical devices. |
| Steps | Not executed against an org. Automated plan: smf-7-call.spec.ts 'SMF-7 CALL-03 authorization boundary' (stage 53, ENV-DESKTOP-EDGE and ENV-CLOUD-CHROMIUM) + Apex tests SMF7_CallAuthServiceTest (14) and SMF7_CallTokenRestResourceTest (4). |
| Expected result | RESTRICTED and wrong-case users cannot obtain/join the room; expired/invalid authorization is rejected without leaking credentials. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-7-CALL.md; docs/smf-7/realtimekit-setup.md; docs/poc-briefs/SMF-7.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking actions: (1) owner: docs/cloud/HUMAN-SETUP.md H1 (allowlist incl. api.cloudflare.com, *.realtime.cloudflare.com; plus stun.cloudflare.com/turn.cloudflare.com for media), H2 (SF_AUTH_URL_DEVHUB), H4 (CF_ACCOUNT_ID, CF_API_TOKEN with Realtime: Edit); (2) agent: stages 20, 30, 40, 45; (3) owner: O-SMF7-1 in docs/smf-7/realtimekit-setup.md (set ApiToken on External Credential SMF7_Cloudflare / principal SMF7_Principal in Setup) — stage 45 detects it; (4) agent: stage 53 (desktop functional rows); (5) humans: none required for desktop; optional mobile check docs/test-scripts/SMF-7-CALL.md CALL-03 step 1 |

Sub-controls: RESTRICTED → MF-ROOM-001 BLOCKED; TECH → MF-ROOM-002 BLOCKED; SUPPORT → MF-ROOM-002 BLOCKED; invalid token BLOCKED; tampered token BLOCKED; revoked token (stand-in) BLOCKED; **expired token NOT TESTED** — cannot be produced on demand (RealtimeKit tokens expire after a fixed 100 days), owner decision C-SMF7-1.

Supporting static evidence (not an outcome): `sf code-analyzer run --rule-selector Recommended` (Code Analyzer 5.16.0, offline, 2026-10-03) on force-app/main/default/classes: 0 Critical, 0 High; 23 Moderate (test-method naming with underscores per the platform-apex-test-generate convention, cyclomatic complexity 12 in issueForAuthorizedCaller, boolean/parameter-list style) and 31 Low (ApexDoc, runAs heuristics), 1 Info. Apex tests were written per platform-apex-test-generate but **could not be executed** (no org): their pass/coverage is unknown. They assume the SMF-3 baseline Case OWD = Private.
