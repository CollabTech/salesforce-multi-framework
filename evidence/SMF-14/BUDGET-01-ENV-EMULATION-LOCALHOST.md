# BUDGET-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — same protocol on both models (software WebGL, stubbed delivery)

| Field | Value |
|---|---|
| Case ID | BUDGET-01 |
| Story | SMF-14 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | claude/smf-14-budget 73c5a03 (VITE_BUILD_COMMIT=73c5a03), localhost run 2 |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 SwiftShader (software); origin http://localhost:5313 static dist/; Salesforce endpoints (SMF-10 Apex REST, Connect file content, CSRF) STUBBED by Playwright routes serving the generated GLBs; no org, no persona; device indicators: 4 cores, deviceMemory 8 GiB, network 4g (Chromium estimate; loopback) |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:05:00Z |
| Preconditions | npm run build:e2e; npx playwright test -c playwright.smf-3d.config.ts e2e/smf-14-budget.spec.ts. Expected statement = the spec assertions, written before the run. |
| Steps | 1. List model Files (stubbed SMF-10 list) 2. Delivery path Connect file content 3. Run harness for all listed models (each: 5 open/close + 60 s scripted protocol) 4. Read the harness JSON |
| Expected result | Localhost-scoped: both models run the identical harness over the stubbed Connect path; each completes 5 successful cycles and the 60 s protocol, and load time, fps distribution, scene complexity and renderer.info/JS-heap figures are recorded for both. |
| Actual result | MF-MODEL-SMALL (MF-MODEL-SMALL, 317796 B, 8676 tris, 0 textures []): cycle interactive ms [434.7, 190.1, 167.9, 161.1, 207.8]; protocol open 142.9 ms; 60 s: 2473 frames / 60017 ms, median 44.1 fps, mean 41.2, p5 28.6, p95 52.4, 8 long frames, max 60 ms; geometries/textures before->after dispose per cycle [10/1->0/1; 10/1->0/1; 10/1->0/1; 10/1->0/1; 10/1->0/1]; JS heap MiB per cycle [9.7, 10.6, 10.3, 9.9, 9.7]; errors 0; context losses 0; harness wall 73467 ms \|\| MF-MODEL-REP (MF-MODEL-REP, 8647528 B, 240692 tris, 4 textures ['1024x1024', '1024x1024', '512x512', '1024x1024']): cycle interactive ms [1337.9, 1262.7, 1308.6, 1317.7, 1617.5]; protocol open 1357.8 ms; 60 s: 222 frames / 60225 ms, median 3.9 fps, mean 3.7, p5 2.5, p95 4.8, 222 long frames, max 592.6 ms; geometries/textures before->after dispose per cycle [10/5->0/1; 10/5->0/1; 10/5->0/1; 10/5->0/1; 10/5->0/1]; JS heap MiB per cycle [34.5, 42.6, 44.9, 43.2, 45]; errors 0; context losses 0; harness wall 155166 ms \|\| Targets on this software row: usable <= 10 s met for both; median >= 30 fps: met (SMALL), NOT met (REP). An earlier run (run 1, rAF-timestamp sampler) reported REP median 59.9 fps while 60 s of rAF time took ~262 s wall time; that defect was fixed (2514b40) and run 1 is superseded. |
| Outcome | PASS |
| Evidence link | evidence/SMF-14/localhost/run-2/BUDGET-01-02.json (superseded: run-1/BUDGET-01-02.json) |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | PASS is against the localhost statement only (the comparison ran and was recorded). SwiftShader numbers say nothing about any device; BUDGET-04 excludes them automatically. Delivery was stubbed (no Salesforce, no network cost). |
