# DATA-01 — n/a — seed twice; counts and logical identities stable, no duplicates

| Field | Value |
|---|---|
| Case ID | DATA-01 |
| Story | SMF-3 |
| Persona pair | MF-ADMIN (runs the seed); grants for MF-TECH, MF-SUPPORT |
| Fixture IDs / hash / version | MF-ACCOUNT-001, MF-ASSET-001, MF-ASSET-002, MF-CASE-001, MF-CASE-002, MF-IMAGE-001 (sha256 c90e207b229f9946…), MF-FILE-DENIED (sha256 c089638bffaf6368…); fixture v1 (testing/fixtures/manifest.json) |
| Build / commit | 137579b (branch claude/smf-3-fixtures) |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14; Node 22.22.0; Python 3.11.15 |
| Environment row | n/a |
| Timestamp | 2026-10-03T22:18:07Z |
| Preconditions | SMF-2 ENV-01..03 PASS (authenticated smf-dev scratch org); stage 30 (metadata) and 31 (personas) done. NOT MET: ENV-01..03 are BLOCKED (evidence/SMF-2/). |
| Steps | 1. bash scripts/cloud/pipeline.sh 30 31 32 — i.e. python3 testing/provisioning/fixtures.py seed-twice --target-org smf-dev --report evidence/SMF-3/runs/<date>-DATA-01.json (preflight describe + OWD, seed.apex, upload missing Files, seed.apex again, counts; repeated twice; record IDs compared privately) 2. Offline only (this run): generate.py --check; unit tests scripts/tests/test_smf3.py; manual review of seed.apex/fixtures.py idempotency (lookup by key before every insert; duplicates reported) |
| Expected result | Seed the data twice; counts and logical identities remain stable, with no duplicate test records. |
| Actual result | Not executed: no Salesforce org is reachable from this environment (no org credential; egress proxy denies Salesforce hosts — SMF-2 ENV-01). No record was created or read. Offline: the seed kit exists and its local checks pass (fixture hashes match the manifest; 27 unit tests pass); these are not DATA-01 results. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-2/ENV-01.md; testing/provisioning/README.md |
| Tester | Implementing agent (Claude Code cloud session) |
| Limitation / follow-up | Unblock: HUMAN-SETUP H1 (network allowlist) + H2 (SF_AUTH_URL_DEVHUB), then pipeline stages 10, 20, 30, 31, 32. First real run must also confirm the Asset Private OWD deploy and the Files upload path (testing/provisioning/README.md 'Known risks'). |
