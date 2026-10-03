# DATA-03 — n/a — profiles, roles, sharing and permission sets match the baseline; real IDs private

| Field | Value |
|---|---|
| Case ID | DATA-03 |
| Story | SMF-3 |
| Persona pair | MF-TECH, MF-SUPPORT, MF-RESTRICTED (queried by MF-ADMIN, read-only) |
| Fixture IDs / hash / version | MF-ACCOUNT-001, MF-ASSET-001, MF-ASSET-002, MF-CASE-001, MF-CASE-002, MF-IMAGE-001, MF-FILE-DENIED |
| Build / commit | 137579b (branch claude/smf-3-fixtures) |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14 |
| Environment row | n/a |
| Timestamp | 2026-10-03T22:18:07Z |
| Preconditions | Stages 30-32 done. NOT MET: SMF-2 ENV-01..03 BLOCKED. |
| Steps | 1. Stage 33: python3 testing/provisioning/baseline.py --target-org smf-dev --report evidence/SMF-3/runs/<date>-DATA-03-baseline.md (OWD, profile, licence, role, active, permission sets, group/queue membership, View/Modify All, object permissions, share rows, sharing-rule count) against testing/provisioning/baseline.json 2. personas.py writes real usernames/IDs only to private/personas.json; fixtures.py writes record IDs only to private/fixtures.json |
| Expected result | Verify profiles/roles/sharing/permission sets match the intended baseline; store actual usernames and Salesforce/provider IDs privately. |
| Actual result | Not executed: no org reachable (SMF-2 ENV-01). The intended baseline is written down (testing/provisioning/baseline.json) and the read-only comparison script exists; no org value was observed. No usernames or IDs exist yet, so nothing private was stored. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-2/ENV-01.md; testing/provisioning/baseline.json |
| Tester | Implementing agent (Claude Code cloud session) |
| Limitation / follow-up | Unblock: H1 + H2, then stages 30-33. Licence capacity (>= 3 free Salesforce licences) is checked first by personas.py; a shortage makes the affected personas BLOCKED, never optional. |
