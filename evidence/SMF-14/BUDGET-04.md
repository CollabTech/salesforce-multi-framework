# BUDGET-04 — n/a — maximum tested scene budget and fallback trigger

| Field | Value |
|---|---|
| Case ID | BUDGET-04 |
| Story | SMF-14 |
| Persona pair | n/a (derived from BUDGET-01..03 results) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-REP sha256:52eb2bab7af338afa088420ecd9e5e8523c29d8d0c1b29146ec51207557d49a5 (8,647,528 B, 240,692 tris, 4 embedded PNG textures 3x1024^2 + 512^2); MF-MODEL-*-DENIED copies (MF-CASE-002); fixture manifest v1.0.0 |
| Build / commit | branch claude/smf-14-budget (see PR head) — not deployed |
| Host / device / OS / app / browser | n/a: publication case. The budget is derived from BUDGET-01..03 results on the required host rows; the inputs are listed by row below. |
| Environment row | n/a (testing/matrix.json applicability: "Publishes the tested budget from BUDGET-01..03; no new host run") |
| Timestamp | 2026-10-03T23:10:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore no deployed app (SMF-4), no personas or cases (SMF-3), no SMF-10 Apex deployed, no model Files (stage 47). BUDGET-04 additionally needs BUDGET-01..03 device results. |
| Steps | docs/test-scripts/SMF-14-BUDGET.md 14 |
| Expected result | Publish the maximum tested scene budget and fallback trigger from the results; do not claim a larger untested operating range. |
| Actual result | Not executed: no BUDGET-01..03 result exists on any required row (table below). No scene budget is published. Only the proposed measurement protocol (harness: 5 open/close cycles + the 60 s scripted protocol per model) and the proposed fallback-trigger rule (docs/poc-briefs/SMF-14.md, src/probes/smf-14-budget/budget.ts) are published. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-14-BUDGET.md; evidence/SMF-14/localhost/run-2/BUDGET-01-02.json |
| Tester | Implementing agent (Claude Code cloud session) — recorded the block only |
| Limitation / follow-up | Smallest unblocking action: complete BUDGET-01..03 on the required rows (HUMAN-ACTIONS D24–D27 after H1/H2 and stages 20/30/40/46/47); the budget is then derived only from hardware-rendered runs on those rows. |

## Budget inputs by required host row

| Env row | Host recorded | Status | Smallest unblocking action |
|---|---|---|---|
| ENV-DESKTOP-CHROME | Google Chrome desktop — not run | BLOCKED | Brandon runs docs/test-scripts/SMF-14-BUDGET.md on a desktop with Chrome after H1/H2 + stages 20/30/40/46/47 (HUMAN-ACTIONS G7). |
| ENV-DESKTOP-EDGE | Microsoft Edge (Linux, cloud) via scripts/cloud/stages/57-smf14-budget.sh — not run | BLOCKED | Performance on this row needs real desktop hardware (cloud Edge renders with SwiftShader): Brandon runs docs/test-scripts/SMF-14-BUDGET.md on a desktop with Edge after H1/H2 + stages 20/30/40/46/47 (HUMAN-ACTIONS G7). |
| ENV-SFMOBILE-IOS | physical iPhone in the Salesforce mobile app — no device available | BLOCKED | After H1/H2 + stages 20/30/40/46/47: device tester runs docs/test-scripts/SMF-14-BUDGET.md on a physical iPhone in the Salesforce app (HUMAN-ACTIONS G5, G6, G8). |
| ENV-SFMOBILE-ANDROID | physical Android phone in the Salesforce mobile app — no device available | BLOCKED | As iOS, on a physical Android phone in the Salesforce app (HUMAN-ACTIONS G5, G6, G8). |

## Supporting check: derivation logic on localhost (ENV-EMULATION-LOCALHOST; not host evidence, not a matrix row)

- Build: claude/smf-14-budget 73c5a03 (VITE_BUILD_COMMIT=73c5a03), localhost run 2. Host: Headless Chromium 141.0.7390.37 (Playwright, Linux container, 4 vCPU), WebGL2 SwiftShader (software); origin http://localhost:5313 static dist/; Salesforce endpoints (SMF-10 Apex REST, Connect file content, CSRF) STUBBED by Playwright routes serving the generated GLBs; no org, no persona. Timestamp: 2026-10-03T23:05:00Z. Tester: Implementing agent (automated Playwright + vitest).
- Steps: 1. After the harness, read the Budget card / evidence JSON 2. Unit tests: derivation with software, localhost and hardware fixtures
- Expected (localhost-scoped, written before the run): Localhost-scoped: the budget logic publishes no scene budget from localhost or software-rendered runs (status insufficient-device-data, runs listed as excluded) and shows the proposed fallback trigger rule.
- Actual: status insufficient-device-data; devices []; excluded [{'envRow': 'ENV-EMULATION-LOCALHOST', 'fixtureId': 'MF-MODEL-SMALL', 'reason': 'not a required host row (localhost/cloud/emulation/mobile browser)'}, {'envRow': 'ENV-EMULATION-LOCALHOST', 'fixtureId': 'MF-MODEL-REP', 'reason': 'not a required host row (localhost/cloud/emulation/mobile browser)'}]; note: No hardware-rendered run on a required host row exists, so no scene budget can be published.
- Result against that localhost statement: met. The budget logic refuses to publish from software-rendered or localhost runs.
- Proposed fallback trigger and limits: No scene budget exists. Proposed fallback trigger: Show the static equipment image instead of 3D when WebGL is unavailable on the host. \| Show the static image (with an explicit "Open 3D anyway" choice) when the model is larger in bytes or triangles than the largest fixture that passed on that device class; if the device class has no passing run, 3D is not offered by default. \| Switch to the static image when the model is not interactive within 10000 ms of the request. \| Offer the static image when the median frame rate over the first 5 s of interaction is below 30 fps. \| Show the static image with a retry when the graphics context is lost and not restored within 3 s (e.g. after backgrounding). \| Show the static image without retry when delivery is denied or the asset is missing/invalid (never fall back to a non-access-checked copy).
- Evidence: evidence/SMF-14/localhost/run-2/BUDGET-01-02.json; docs/poc-briefs/SMF-14.md

_Consolidated by the integrator from the per-row records BUDGET-04-ENV-*.md (in git history at 85b18f1). The SMF-3 matrix defines BUDGET-04 as one `n/a` row._
