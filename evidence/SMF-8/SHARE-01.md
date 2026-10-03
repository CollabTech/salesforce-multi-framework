# SHARE-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows, by direction) — required rows

| Field | Value |
|---|---|
| Case ID | SHARE-01 |
| Story | SMF-8 |
| Persona pair | MF-SUPPORT (initial sharer) + MF-TECH (receiver); reversed where the host offers sharing |
| Fixture IDs / hash / version | MF-ROOM-001; synthetic diagnostic screen (route /probes/diagnostic-screen); fallback image = PLACEHOLDER (MF-IMAGE-001 not available) |
| Build / commit | branch claude/smf-8-share (probes smf-08-share, smf-08-diagnostic-screen; stage 53); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host or Cloudflare service reachable |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows, by direction) |
| Timestamp | 2026-10-03T22:45:00Z |
| Preconditions | Depends on SMF-7, whose rows are all BLOCKED: SMF-2 ENV-01..03 BLOCKED (no org credential; Salesforce egress denied), no Cloudflare account/token (HUMAN-SETUP H4) and api.cloudflare.com blocked; no physical devices; MF-IMAGE-001 asset not on this branch (placeholder used). |
| Steps | Not executed. Automated part: testing/cloud-e2e/tests/smf-8-share.spec.ts (stage 53). Human part: docs/test-scripts/SMF-8-SHARE.md SHARE-01 steps 1–5. |
| Expected result | Start from a gesture, confirm the other participant sees the changing screen, then stop and restart. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-8-SHARE.md; docs/poc-briefs/SMF-8.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking actions: everything in evidence/SMF-7/CALL-01.md (H1, H2, H4, stages 20–45, owner step O-SMF7-1), then agent: stage 53 (desktop functional rows); humans: docs/test-scripts/SMF-8-SHARE.md SHARE-01 steps 1–5 for rows S1–S3 |

Rows by direction and host (SMF-8 AC2):

| Row | Sharer → receiver | Outcome | Executor once unblocked |
|---|---|---|---|
| S1 | desktop Chrome → desktop Edge | BLOCKED | stage 53 (fake capture, functional) + humans (screen seen) |
| S2 | desktop → ENV-SFMOBILE-IOS (receive) | BLOCKED | humans only |
| S3 | desktop → ENV-SFMOBILE-ANDROID (receive) | BLOCKED | humans only |
| S4 | ENV-SFMOBILE-IOS (originate) → desktop | BLOCKED | humans only |
| S5 | ENV-SFMOBILE-ANDROID (originate) → desktop | BLOCKED | humans only |

Mobile receiving and mobile originating are separate rows; neither is inferred from the other.
