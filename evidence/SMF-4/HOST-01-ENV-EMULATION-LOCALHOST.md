# HOST-01 — ENV-EMULATION-LOCALHOST — localhost exploratory — not host evidence — app shell and navigation

| Field | Value |
|---|---|
| Case ID | HOST-01 |
| Story | SMF-4 |
| Persona pair | none (no Salesforce session) |
| Fixture IDs / hash / version | none |
| Build / commit | 7d6b5ea |
| Host / device / OS / app / browser | Linux cloud container; headless Chromium 1194 (Playwright 1.63); static server `serve -s dist` |
| Environment row | ENV-EMULATION-LOCALHOST |
| Timestamp | 2026-10-03T21:52Z |
| Preconditions | Built dist/; no org |
| Steps | cd force-app/main/default/uiBundles/FieldSupport && PW_CHROMIUM_PATH=… npx playwright test (e2e/app.spec.ts) |
| Expected result | Localhost-scoped (written before running): the shell renders the Launch check page with host context, reports that no Salesforce user can be read, in-app navigation reaches /launch/navigation and back, and unknown routes show 404. |
| Actual result | 3/3 Playwright tests passed: Launch check heading and host context (origin http://localhost) visible; alert 'Could not read the Salesforce user'; navigation to /launch/navigation and back; 404 page. |
| Outcome | PASS |
| Evidence link | docs/smf-4/build-verification.md; force-app/main/default/uiBundles/FieldSupport/e2e/app.spec.ts |
| Tester | Implementing agent |
| Limitation / follow-up | Says nothing about Salesforce hosting, authentication, mobile, or reload of deep links. Does not change HOST-01's required rows (BLOCKED). |
