# ENV-02 — n/a — org/CLI readiness — scratch-org/package capacity and licences for the personas

| Field | Value |
|---|---|
| Case ID | ENV-02 |
| Story | SMF-2 |
| Persona pair | MF-ADMIN (read-only queries); sizing for MF-TECH, MF-SUPPORT, MF-RESTRICTED |
| Fixture IDs / hash / version | n/a |
| Build / commit | b79111a |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14 |
| Environment row | n/a — org/CLI readiness |
| Timestamp | 2026-10-03T21:34:20Z |
| Preconditions | ENV-01 identity verified (not met) |
| Steps | 1. readiness.py: sf org list limits (ActiveScratchOrgs, DailyScratchOrgs, Package2VersionCreates) on smf-devhub 2. readiness.py: UserLicense free counts (Salesforce, Salesforce Platform) on smf-dev and smf-install-test; need >= 3 free Salesforce licences (TECH, SUPPORT, RESTRICTED; MF-CASE-002 owned by MF-ADMIN) |
| Expected result | Record scratch-org/package capacity and licenses sufficient for the defined test personas; shortages produce explicit blockers. |
| Actual result | Not executed: no authenticated org (see ENV-01). Documented limits for a Developer-Edition Dev Hub: 3 active / 6 daily scratch orgs, package versions per day = daily scratch allocation. Licence counts unknown. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-2/readiness-2026-10-03.md |
| Tester | Implementing agent |
| Limitation / follow-up | Same unblock as ENV-01. Known risk: Case access needs full Salesforce licences; if fewer than 3 are free in smf-dev, SMF-3 DATA-01..03 are BLOCKED for the affected persona — MF-RESTRICTED is never dropped. Note: the script's licence threshold counts the MF-CASE-002 owner; MF-ADMIN owns it, so the effective need is 3 (script corrected in this PR). |
