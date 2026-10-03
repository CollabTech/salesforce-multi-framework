# 3D-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — probe interaction logic

| Field | Value |
|---|---|
| Case ID | 3D-01 |
| Story | SMF-13 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | claude/smf-13-3d 2514b40 (run 3); runs 1-2 at the 04b5bd1 working tree |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 via "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" = software rendering; origin http://localhost:5313 (static serve of dist/, no Salesforce session); the UA string is Playwright's Desktop Chrome descriptor, not the engine |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T22:50:31Z |
| Preconditions | npm run build:e2e; npx playwright test -c playwright.smf-3d.config.ts (e2e/smf-13-3d.spec.ts). The expected statement is the spec assertions, written before the run. |
| Steps | 1. open /probes/3d, wait for status ready 2. mouse drag 160 px (orbit) and wheel -400 (zoom) 3. click canvas points until a part is selected; label visible 4. select Impeller from the Parts list 5. Reset view clears selection 6. viewport 1280x800 -> 390x844 -> 1280x800 7. separate hasTouch/isMobile context 390x844@3x: touchscreen.tap selects a part |
| Expected result | Localhost-scoped: in headless Chromium with software WebGL the model loads to status ready; mouse orbit/zoom are accepted; a pointer click and an emulated touch tap each select a named part and show its label; list selection selects MF-PART-IMPELLER; Reset clears selection; viewport changes are handled (resize events logged). |
| Actual result | All assertions held (runs 1, 2 and 3: 5/5 tests passed each). Run 3 interactive after 401 ms (desktop viewport); run 2: 369 ms desktop, 160 ms touch context. Pointer click selected "Discharge outlet (MF-PART-OUTLET)"; emulated tap selected "Electric motor (MF-PART-MOTOR)"; list selection MF-PART-IMPELLER; reset -> none; resize log entries present. Scene 8,676 triangles, 10 meshes, 10 draw calls; loader requested 0 URLs (no external fetch). |
| Outcome | PASS |
| Evidence link | evidence/SMF-13/localhost/run-3/3D-01.json; evidence/SMF-13/localhost/run-3/3D-01-touch.json (earlier: run-2/) |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | Not host evidence: no Salesforce frame, no persona, emulated tap only (no pinch, no physical rotation), software WebGL. Does not change any required row. |
