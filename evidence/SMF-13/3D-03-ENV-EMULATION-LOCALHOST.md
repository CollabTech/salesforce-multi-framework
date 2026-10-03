# 3D-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — failure paths, fallback, released resources

| Field | Value |
|---|---|
| Case ID | 3D-03 |
| Story | SMF-13 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | claude/smf-13-3d 2514b40 (run 3); runs 1-2 at the 04b5bd1 working tree |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 via "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" = software rendering; origin http://localhost:5313 (static serve of dist/, no Salesforce session); the UA string is Playwright's Desktop Chrome descriptor, not the engine; plus a second browser launched with --disable-gpu --disable-software-rasterizer --disable-webgl |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:50:31Z |
| Preconditions | As 3D-01 localhost. |
| Steps | 1. Load missing model 2. Retry loading MF-MODEL-SMALL 3. Lose graphics context (WEBGL_lose_context) then Restore 4. Unmount 3D view (count canvases) then Remount 5. Simulate no WebGL 6. separate browser with WebGL disabled: open the probe |
| Expected result | Localhost-scoped: missing model -> status error + static image with alt text; context loss -> fallback, restore -> ready; unmount removes the canvas and every disposal reports 0 geometries after release; remount -> ready; simulated and real WebGL unavailability -> static fallback with no canvas. |
| Actual result | Run 3 (as runs 1-2): all assertions held. All assertions held. Missing model: the static server answered the absent .glb with its SPA index.html (200, text/html); the probe reported "invalid: response is not a usable GLB (not a GLB: first bytes <!doctype html> ...)" and showed the fallback image + alt text. Context loss/restore: fallback, then ready (three.js re-initialised). Two disposals: before geometries 10 / textures 1 / programs 1 -> after geometries 0 / textures 1 / programs 0; context released; canvas removed; remount ready. Real WebGL-disabled browser: getContext returned null -> status no-webgl, fallback shown, 0 canvases. |
| Outcome | PASS |
| Evidence link | evidence/SMF-13/localhost/run-3/3D-03.json; evidence/SMF-13/localhost/run-3/3D-03-no-webgl.json (earlier: run-2/) |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | The 1 texture remaining after model disposal is three.js's shared DFG lookup table (PBR), released with the renderer. Context loss was simulated via WEBGL_lose_context, not a real GPU reset or mobile backgrounding. Not host evidence. |
