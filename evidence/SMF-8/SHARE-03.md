# SHARE-03 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows, by direction) — required rows

| Field | Value |
|---|---|
| Case ID | SHARE-03 |
| Story | SMF-8 |
| Persona pair | MF-SUPPORT (initial sharer) + MF-TECH (receiver); reversed where the host offers sharing |
| Fixture IDs / hash / version | MF-ROOM-001; synthetic diagnostic screen (route /probes/diagnostic-screen); fallback image = PLACEHOLDER (MF-IMAGE-001 not available) |
| Build / commit | branch claude/smf-8-share (probes smf-08-share, smf-08-diagnostic-screen; stage 54); not deployed |
| Host / device / OS / app / browser | none — no Salesforce host or Cloudflare service reachable |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID (required rows, by direction) |
| Timestamp | 2026-10-03T22:45:00Z |
| Preconditions | Depends on SMF-7, whose rows are all BLOCKED: SMF-2 ENV-01..03 BLOCKED (no org credential; Salesforce egress denied), no Cloudflare account/token (HUMAN-SETUP H4) and api.cloudflare.com blocked; no physical devices; MF-IMAGE-001 asset not on this branch (placeholder used). |
| Steps | Not executed. Automated part: testing/cloud-e2e/tests/smf-8-share.spec.ts (stage 54). Human part: docs/test-scripts/SMF-8-SHARE.md SHARE-03 steps 1–4. |
| Expected result | If screen audio is offered, test it separately. Mark unsupported/cancelled cases honestly; do not count a visible button as success. |
| Actual result | Not executed in any required environment. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-8-SHARE.md; docs/poc-briefs/SMF-8.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the blocker only |
| Limitation / follow-up | Smallest unblocking actions: everything in evidence/SMF-7/CALL-01.md (H1, H2, H4, stages 20–45, owner step O-SMF7-1), then agent: stage 54 (desktop functional rows); humans: docs/test-scripts/SMF-8-SHARE.md SHARE-03 steps 1–4 on desktop row S1 |

Screen audio: NOT TESTED on every row; recorded only if a host offers it (separate optional capability). Fake-device cloud runs can report 'captured / not captured' but never 'heard'.
