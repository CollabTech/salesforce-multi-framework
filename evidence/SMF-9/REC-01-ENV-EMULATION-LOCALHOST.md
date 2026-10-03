# REC-01 — ENV-EMULATION-LOCALHOST — localhost exploratory (simulated transport) — not host evidence

| Field | Value |
|---|---|
| Case ID | REC-01 |
| Story | SMF-9 |
| Persona pair | none (no Salesforce session, no call) |
| Fixture IDs / hash / version | SIMULATED transport (probe mode 'Simulated transport', labelled in the UI); canvas video track |
| Build / commit | branch claude/smf-9-recovery working tree (unpublished build 'local') |
| Host / device / OS / app / browser | Linux container; Playwright 1.63.0, Chromium 141.0.7390.37 headless; bundle via npm run build:e2e on http://localhost:5176 |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:47:57Z |
| Preconditions | Simulated client: offline → socket/send/recv disconnected and remotes cleared; online → reconnecting after 800 ms, connected + remote back after 1500 ms. |
| Steps | 1. Open /probes/recovery → Simulated transport → Join → Camera on 2. For runs 1–3: select Run n; context.setOffline(true); wait n s; setOffline(false); wait for socket=connected, remotes=1 3. Inject duplicate remote (separate test) and read the duplicate alert |
| Expected result | Localhost-scoped statement (written before running): three network-loss episodes appear, each with a recovery time and none 'NOT RECOVERED'; variability reads 3/3 recovered; an injected duplicate remote raises the duplicate alert. |
| Actual result | Matched (run 22:47:57Z, after adding post-recovery remote counting): network-loss run 1 detect 2 ms / recover 2532 ms; run 2 0 / 3519 ms; run 3 1 / 4510 ms (= offline time + simulated 1.5 s); max remotes 1, duplicates no; variability 3/3 · min 2532 · median 3519 · max 4510 ms. Injected duplicate → alert shown. Earlier run (22:47:03Z, before the change) had identical timings but reported max remotes 0 because the remote list arrived after recovery; the tracker now counts remotes for 10 s after recovery. |
| Outcome | PASS |
| Evidence link | force-app/main/default/uiBundles/FieldSupport/e2e/media/smf-09-recovery.granted.media.ts |
| Tester | Implementing agent (automated Playwright run) |
| Limitation / follow-up | All timings are produced by the simulator; they say nothing about RealtimeKit, Salesforce hosts or phones. Required rows stay BLOCKED. |
