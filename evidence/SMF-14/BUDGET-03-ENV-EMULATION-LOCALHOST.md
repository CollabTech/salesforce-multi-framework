# BUDGET-03 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — delivery code paths against stubbed endpoints

| Field | Value |
|---|---|
| Case ID | BUDGET-03 |
| Story | SMF-14 |
| Persona pair | none (no org; localhost) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | claude/smf-14-budget 73c5a03 (VITE_BUILD_COMMIT=73c5a03), localhost run 2 |
| Host / device / OS / app / browser | Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 SwiftShader (software); origin http://localhost:5313 static dist/; Salesforce endpoints (SMF-10 Apex REST, Connect file content, CSRF) STUBBED by Playwright routes serving the generated GLBs; no org, no persona |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T23:05:00Z |
| Preconditions | As BUDGET-01 localhost. Stub: allowed Ids serve the generated GLBs; denial-control Ids answer 404 (Apex) / 403 (Connect); the MF-CASE-002 stand-in listing answers 404. |
| Steps | 1. Check delivery of both models over Connect and over SMF-10 Apex REST 2. Try fetch a denial-control Id on each path 3. Check delivery of the bundled app asset 4. Open MF-MODEL-REP while recording every network request 5. List Files for the MF-CASE-002 stand-in |
| Expected result | Localhost-scoped: the probe delivers both fixtures with matching sha256 on both paths; both denial controls end "denied" with no bytes; the case-2 listing is refused; while loading REP the only network request is the one model request (embedded textures, no texture URL); the bundled asset is delivered and labelled as not case-checked. |
| Actual result | MF-MODEL-SMALL via connect-content: delivered (317796 B, HTTP 200, MF-MODEL-SMALL); MF-MODEL-REP via connect-content: delivered (8647528 B, HTTP 200, MF-MODEL-REP); denial control via connect-content: denied (denied (HTTP 403): HTTP 403 from Connect file content); MF-MODEL-SMALL via smf10-apex: delivered (317796 B, HTTP 200, MF-MODEL-SMALL); MF-MODEL-REP via smf10-apex: delivered (8647528 B, HTTP 200, MF-MODEL-REP); denial control via smf10-apex: denied (denied (HTTP 404): not found or no access (HTTP 404)); MF-MODEL-SMALL (bundled asset) via bundled: delivered (317796 B, HTTP 200, MF-MODEL-SMALL). Requests while opening REP: ['GET /services/apexrest/smf10/v1/versions/<id>/data'] (embedded textures decoded in-page; no texture request). Case-2 listing: Not found or no access.. |
| Outcome | PASS |
| Evidence link | evidence/SMF-14/localhost/run-2/BUDGET-03.json |
| Tester | Implementing agent (automated Playwright) |
| Limitation / follow-up | Stubbed endpoints: proves the probe's request/validation/denial handling only — not Salesforce sharing, RESTRICTED denial, Connect availability in the UI-bundle host, or the expected Apex 6 MB heap refusal for REP on the SMF-10 path (the stub cannot reproduce it). Bypass finding to carry to host runs: the bundled MF-MODEL-SMALL app asset is delivered to anyone who can load the app bundle, without a case/Files check (synthetic, non-sensitive; production models must use the Files path). |
