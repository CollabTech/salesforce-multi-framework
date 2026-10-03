# REC-03 — ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (physical phone as MF-TECH) ↔ desktop MF-SUPPORT; desktop rows exploratory/automated — required rows

| Field | Value |
|---|---|
| Case ID | REC-03 |
| Story | SMF-9 |
| Persona pair | MF-TECH on a physical phone + MF-SUPPORT on desktop; device tester performs interruptions |
| Fixture IDs / hash / version | Active MF-ROOM-001 call; fixed synthetic A/V script (SMF-7 test phrase + counters); not provisioned |
| Build / commit | branch claude/smf-9-recovery (probe smf-09-recovery; stage 55); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host, Cloudflare service or physical device reachable |
| Environment row | ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (physical phone as MF-TECH) ↔ desktop MF-SUPPORT; desktop rows exploratory/automated |
| Timestamp | 2026-10-03T22:50:00Z |
| Preconditions | Depends on SMF-7, whose rows are all BLOCKED: SMF-2 ENV-01..03 BLOCKED (no org credential; Salesforce egress denied), no Cloudflare account/token (HUMAN-SETUP H4), api.cloudflare.com blocked; no physical iPhone/Android, no SIM/cellular, no third phone for the incoming call. |
| Steps | Not executed. Human script: docs/test-scripts/SMF-9-RECOVERY.md (REC-03). Automated desktop part: testing/cloud-e2e/tests/smf-9-recovery.spec.ts (stage 55). |
| Expected result | Verify explicit leave/rejoin recovery and that local media stops on leave. Any unperformed interruption remains BLOCKED/NOT TESTED. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-9-RECOVERY.md; docs/poc-briefs/SMF-9.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking actions: everything in evidence/SMF-7/CALL-01.md (H1, H2, H4, stages 20–45, O-SMF7-1); agent: stage 55 (desktop rows); humans: docs/test-scripts/SMF-9-RECOVERY.md REC-03 steps 1–3 ×3 on both phones |

Per-scenario rows (3 runs each, AC4):

| Scenario | Row | Runs | Outcome | Executor once unblocked |
|---|---|---|---|---|
| Leave/rejoin | ENV-SFMOBILE-IOS | 0/3 | BLOCKED | human |
| Leave/rejoin | ENV-SFMOBILE-ANDROID | 0/3 | BLOCKED | human |
| Leave/rejoin | ENV-DESKTOP-EDGE / ENV-CLOUD-CHROMIUM | 0/3 | BLOCKED | agent stage 55 (fake devices) |

No interruption was performed; every row stays BLOCKED until executed. No claim of uninterrupted background capture is made.
