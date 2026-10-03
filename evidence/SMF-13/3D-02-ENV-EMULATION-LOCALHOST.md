# 3D-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — 60 s protocol on software WebGL

| Field | Value |
|---|---|
| Case ID | 3D-02 |
| Story | SMF-13 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | claude/smf-13-3d 2514b40 (run 3); runs 1-2 at the 04b5bd1 working tree |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 via "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" = software rendering; origin http://localhost:5313 (static serve of dist/, no Salesforce session); the UA string is Playwright's Desktop Chrome descriptor, not the engine |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:50:31Z |
| Preconditions | As 3D-01 localhost; nothing else running in the browser. Network: loopback. |
| Steps | 1. open /probes/3d, wait for ready 2. Run 60 s protocol (scripted camera path, input disabled) 3. read the judgement and evidence JSON |
| Expected result | Localhost-scoped: the protocol completes repeatably and reports interactive time, median/p5/p95 fps and long frames; the fixed 3D-02 targets (usable <= 10 s, median >= 30 fps) are applied to this software-rendered row only. |
| Actual result | Run 3 (2514b40, corrected sampler: performance.now() + 1-pixel GPU sync per frame): interactive 333 ms; 1,200 frames / 60,054 ms; median 24.4 fps, mean 20.0, p5 10.6, p95 42.9, 472 long frames (>50 ms), max 157.8 ms; no context loss. Usable target met; median-fps target NOT met. Runs 1-2 (04b5bd1) timed frames with rAF timestamps, which a later SMF-14 run showed can run ahead of wall-clock time on SwiftShader; their figures (median 29.9 and 20.0 fps) are kept in run-1/run-2 JSON but superseded as a measurement defect. |
| Outcome | FAIL |
| Evidence link | evidence/SMF-13/localhost/run-3/3D-02.json (superseded: run-1/3D-02.json, run-2/3D-02.json) |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | SwiftShader CPU rendering in a shared container: says nothing about any desktop or mobile device. 3D-02 required rows remain BLOCKED; this FAIL is not a device result. |
