# HOST-01 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID — intended users launch, navigate, reload, keep authenticated context

| Field | Value |
|---|---|
| Case ID | HOST-01 |
| Story | SMF-4 |
| Persona pair | MF-TECH, MF-SUPPORT (each in its own session) |
| Fixture IDs / hash / version | MF-CASE-001 (SMF-3, not provisioned) |
| Build / commit | 7d6b5ea (app built; not deployed) |
| Host / device / OS / app / browser | none — no Salesforce host reachable |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID |
| Timestamp | 2026-10-03T21:52Z |
| Preconditions | Deployed app in smf-dev; personas with FieldSupport_Access (docs/smf-4/deploy.md) |
| Steps | docs/test-scripts/SMF-4-HOST.md § HOST-01 steps 1–7, per persona and env row |
| Expected result | Each intended user launches the deployed internal app, refreshes, navigates, and retains the correct authenticated context. |
| Actual result | Not executed in any required row. The app was generated with the official skill and passes build, lint (0 errors), unit tests and the official verify-rules check (docs/smf-4/build-verification.md), but it could not be deployed: no org credential and egress to Salesforce is denied (SMF-2 ENV-01..03 BLOCKED); SMF-3 personas are not provisioned. Separate localhost exploratory run: the shell renders, in-app navigation works and the page reports the missing Salesforce session — not host evidence. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-4/build-verification.md; docs/test-scripts/SMF-4-HOST.md |
| Tester | Implementing agent (build/localhost only); host rows: not performed |
| Limitation / follow-up | Unblock in order: SMF-2 org access → SMF-3 DATA-01..03 → docs/smf-4/deploy.md steps 1–4 → Brandon runs SMF-4-HOST.md HOST-01 in each env row. Deep-link reload could not be exercised on localhost (relative assets need the Salesforce-injected <base href>); it is part of the host script. |
