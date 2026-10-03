# BUDGET-02 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — open/close x5, viewport rotation, tab background

| Field | Value |
|---|---|
| Case ID | BUDGET-02 |
| Story | SMF-14 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | claude/smf-14-budget 73c5a03 (VITE_BUILD_COMMIT=73c5a03), localhost run 2 |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 SwiftShader (software); origin http://localhost:5313 static dist/; Salesforce endpoints (SMF-10 Apex REST, Connect file content, CSRF) STUBBED by Playwright routes serving the generated GLBs; no org, no persona |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:05:00Z |
| Preconditions | As BUDGET-01 localhost (same run). |
| Steps | 1. Harness: 5 open/close cycles per model (fresh fetch + load + 1 s render + dispose) 2. Open MF-MODEL-REP 3. viewport 1280x900 -> 600x1000 -> 1280x900 4. open a second tab, bring it to front 2 s, return; wait 4 s |
| Expected result | Localhost-scoped: 5/5 cycles per model succeed with 0 errors and 0 context losses, geometries released to 0 after each close; the REP view survives the viewport change; the background/foreground transition is logged with the recovery status. |
| Actual result | SMALL cycles ok 5/5, REP cycles ok 5/5; errors 0; context losses 0; every close released geometries to 0 (textures to 1 = three.js shared DFG LUT). Post-harness log: ['viewer: resize 974x448', 'open MF-MODEL-REP: interactive 1392.9 ms, 240692 triangles, 4 textures (1024x1024, 1024x1024, 512x512, 1024x1024)', 'app visible again after ? ms; 3D context lost: false', 'foreground recovery: 3D view live 3 s after return'] |
| Outcome | PARTIAL |
| Evidence link | evidence/SMF-14/localhost/run-2/BUDGET-01-02.json |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | Worked: 5/5 open/close per model, release counts, no errors or context loss, foreground handler ran and reported the view live. Not shown: no resize event was logged for the 600x1000 -> 1280x900 viewport change (with REP at ~4 fps both changes fell inside the same few frames and coalesced to the original size; the 500 ms test window was too short), and headless Chromium kept the page "visible" during the tab switch, so the background path (hidden -> visible) was exercised only by a synthetic event. Viewport resize stands in for rotation; a Playwright tab switch is not mobile backgrounding (no OS memory pressure, no GPU context eviction). Device rows remain BLOCKED. |
