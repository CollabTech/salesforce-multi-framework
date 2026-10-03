# REC-03 — ENV-EMULATION-LOCALHOST — localhost exploratory (simulated transport) — not host evidence

| Field | Value |
|---|---|
| Case ID | REC-03 |
| Story | SMF-9 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | SIMULATED transport (probe mode 'Simulated transport', labelled in the UI); canvas video track |
| Build / commit | branch claude/smf-9-recovery working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:47:57Z |
| Preconditions | Simulated session with a canvas video track as local media. |
| Steps | 1. Join (simulated), Camera on, inject duplicate 2. Leave; read Last leave 3. Join again; read remotes and duplicate alert |
| Expected result | Localhost-scoped statement (written before running): Leave reports every local track ended; rejoin shows remotes=1 and no duplicate alert. |
| Actual result | Matched: 'Last leave: video:ended · all ended=true'; after rejoin remotes=1, no duplicate alert. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-09-recovery.granted.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | Simulator only. Server-side participant reuse (no duplicate on rejoin) is covered by the unexecuted Apex test shouldRefreshNotDuplicate_WhenSameUserRequestsAgain (SMF-7). Required rows stay BLOCKED. |
