# BUDGET-04 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — budget derivation refuses software/localhost runs

| Field | Value |
|---|---|
| Case ID | BUDGET-04 |
| Story | SMF-14 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | claude/smf-14-budget 73c5a03 (VITE_BUILD_COMMIT=73c5a03), localhost run 2 |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 SwiftShader (software); origin http://localhost:5313 static dist/; Salesforce endpoints (SMF-10 Apex REST, Connect file content, CSRF) STUBBED by Playwright routes serving the generated GLBs; no org, no persona |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:05:00Z |
| Preconditions | Same run as BUDGET-01 localhost; unit tests src/probes/smf-14-budget/__tests__/budget.test.ts. |
| Steps | 1. After the harness, read the Budget card / evidence JSON 2. Unit tests: derivation with software, localhost and hardware fixtures |
| Expected result | Localhost-scoped: the budget logic publishes no scene budget from localhost or software-rendered runs (status insufficient-device-data, runs listed as excluded) and shows the proposed fallback trigger rule. |
| Actual result | status insufficient-device-data; devices []; excluded [{'envRow': 'ENV-EMULATION-LOCALHOST', 'fixtureId': 'MF-MODEL-SMALL', 'reason': 'not a required host row (localhost/cloud/emulation/mobile browser)'}, {'envRow': 'ENV-EMULATION-LOCALHOST', 'fixtureId': 'MF-MODEL-REP', 'reason': 'not a required host row (localhost/cloud/emulation/mobile browser)'}]; note: No hardware-rendered run on a required host row exists, so no scene budget can be published. |
| Outcome | PASS |
| Evidence link | evidence/SMF-14/localhost/run-2/BUDGET-01-02.json; docs/poc-briefs/SMF-14.md |
| Tester | Implementing agent (automated Playwright + vitest) |
| Limitation / follow-up | No scene budget exists. Proposed fallback trigger: Show the static equipment image instead of 3D when WebGL is unavailable on the host. \| Show the static image (with an explicit "Open 3D anyway" choice) when the model is larger in bytes or triangles than the largest fixture that passed on that device class; if the device class has no passing run, 3D is not offered by default. \| Switch to the static image when the model is not interactive within 10000 ms of the request. \| Offer the static image when the median frame rate over the first 5 s of interaction is below 30 fps. \| Show the static image with a retry when the graphics context is lost and not restored within 3 s (e.g. after backgrounding). \| Show the static image without retry when delivery is denied or the asset is missing/invalid (never fall back to a non-access-checked copy). |
