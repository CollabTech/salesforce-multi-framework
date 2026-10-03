# 3D-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — 60 s protocol on software WebGL

| Field | Value |
|---|---|
| Case ID | 3D-02 |
| Story | SMF-13 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | run 1: smf13-wip; run 2: smf13-local (same probe logic) |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 via "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" = software rendering; origin http://localhost:5313 (static serve of dist/, no Salesforce session); the UA string is Playwright's Desktop Chrome descriptor, not the engine |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:14:39Z |
| Preconditions | As 3D-01 localhost; nothing else running in the browser. Network: loopback. |
| Steps | 1. open /probes/3d, wait for ready 2. Run 60 s protocol (scripted camera path, input disabled) 3. read the judgement and evidence JSON |
| Expected result | Localhost-scoped: the protocol completes repeatably and reports interactive time, median/p5/p95 fps and long frames; the fixed 3D-02 targets (usable <= 10 s, median >= 30 fps) are applied to this software-rendered row only. |
| Actual result | Run 1: interactive 340 ms; 1,270 frames / 60,014 ms; median 29.9 fps, mean 21.2, p5 10.0, p95 60.2, 352 long frames (>50 ms), max 216.7 ms. Run 2: interactive 250 ms; 1,058 frames / 60,014 ms; median 20.0 fps, mean 17.6, p5 7.5, p95 60.2, 439 long frames, max 366.6 ms. No context loss. Usable target met; median-fps target NOT met in either run. Large run-to-run spread (shared CPU, software rasteriser). |
| Outcome | FAIL |
| Evidence link | evidence/SMF-13/localhost/run-1/3D-02.json; evidence/SMF-13/localhost/run-2/3D-02.json |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | SwiftShader CPU rendering in a shared container: says nothing about any desktop or mobile device. 3D-02 required rows remain BLOCKED; this FAIL is not a device result. |
