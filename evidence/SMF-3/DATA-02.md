# DATA-02 — n/a — persona access to MF-CASE-001/MF-IMAGE-001 and denial of MF-CASE-002/MF-FILE-DENIED (org level)

| Field | Value |
|---|---|
| Case ID | DATA-02 |
| Story | SMF-3 |
| Persona pair | MF-TECH, MF-SUPPORT, MF-RESTRICTED (each validates own access); MF-ADMIN provisions only |
| Fixture IDs / hash / version | MF-CASE-001, MF-CASE-002, MF-IMAGE-001, MF-FILE-DENIED, MF-ASSET-001, MF-ASSET-002; fixture v1 |
| Build / commit | 137579b (branch claude/smf-3-fixtures) |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14 |
| Environment row | n/a |
| Timestamp | 2026-10-03T22:18:07Z |
| Preconditions | DATA-01 seeded; personas provisioned (stage 31). NOT MET: SMF-2 ENV-01..03 BLOCKED. |
| Steps | 1. Stage 33: python3 testing/provisioning/baseline.py --target-org smf-dev (UserRecordAccess per persona x fixture, share rows, File links) 2. Stage 34: python3 testing/provisioning/access_tests.py --target-org smf-dev (MF_AccessBaselineTest: 17 System.runAs + WITH USER_MODE methods) 3. Host rows (not this record): stage 51 cloud browser spec for ENV-DESKTOP-EDGE/ENV-CLOUD-CHROMIUM; docs/test-scripts/ENV-*.md for interactive login and mobile rows 4. Offline only (this run): Code Analyzer 5.16.0 PMD on MF_AccessBaselineTest — 2 findings, both intended (SeeAllData=true, C-06; one method without runAs by design); Playwright spec typechecked (tsc --noEmit) against the integrator harness |
| Expected result | TECH and SUPPORT can access MF-CASE-001 and its image; RESTRICTED cannot. All business personas are denied MF-CASE-002 and MF-FILE-DENIED. |
| Actual result | Not executed: no org, no persona users and no fixtures exist yet (SMF-2 ENV-01..03 BLOCKED). Nothing was deployed, compiled or run. The host rows of this case (desktop Chrome/Edge, physical Salesforce mobile iOS/Android, mobile Safari/Chrome, cloud Chromium) remain NOT TESTED in the matrix — they were not attempted, and the physical-device rows additionally need a device tester. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-2/ENV-01.md; testing/provisioning/README.md |
| Tester | Implementing agent (Claude Code cloud session) |
| Limitation / follow-up | Unblock: H1 + H2, then stages 30-34 and 51; device rows need Brandon/a device tester with SMF_TESTER_EMAIL set (H6). runAs and frontdoor sessions do not prove interactive password/MFA login or mobile behaviour; those stay with the human scripts. |
