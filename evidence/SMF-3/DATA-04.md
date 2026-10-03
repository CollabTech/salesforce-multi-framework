# DATA-04 — n/a — fixtures, hashes, cleanup/reset script, per-environment scripts, matrix initialised

| Field | Value |
|---|---|
| Case ID | DATA-04 |
| Story | SMF-3 |
| Persona pair | n/a (repository deliverables); scripts name MF-TECH, MF-SUPPORT, MF-RESTRICTED |
| Fixture IDs / hash / version | MF-IMAGE-001 480986 B sha256 c90e207b229f9946…; MF-FILE-DENIED 480988 B sha256 c089638bffaf6368…; MF-UPLOAD-INVALID .txt 254 B sha256 71299590baee9968… and > 5 MiB PNG 5882082 B sha256 03b7274ebec2319d… (regenerated, not committed); full hashes in testing/fixtures/manifest.json |
| Build / commit | 137579b (branch claude/smf-3-fixtures) |
| Host / device / OS / app / browser | Linux cloud container; Python 3.11.15; Salesforce CLI 2.152.14 (no org) |
| Environment row | n/a |
| Timestamp | 2026-10-03T22:18:07Z |
| Preconditions | None for the offline parts; the reset script needs an org with seeded fixtures (SMF-2 ENV-01..03 BLOCKED). |
| Steps | 1. python3 testing/fixtures/generate.py, then --check (byte-identical regeneration; sizes within limits) 2. Visual check of MF-IMAGE-001 and MF-FILE-DENIED (synthetic drawings; no people, location or EXIF; PNG chunks IHDR/PLTE/tEXt/IDAT/IEND) 3. python3 scripts/build-matrix.py --sync, then python3 scripts/build-matrix.py (328 rows over 54 case IDs; validation) 4. Wrote reset (testing/provisioning/apex/reset.apex + fixtures.py reset --reseed) and per-environment scripts docs/test-scripts/ENV-*.md 5. python3 -m unittest discover -s scripts/tests (27 tests) and the AGENTS.md section 7 checks |
| Expected result | Generate the fixtures, hashes, cleanup/reset script, and per-environment test scripts. Populate all matrix rows as NOT TESTED until executed. |
| Actual result | Fixtures and hashes: generated and verified (deterministic; MF-IMAGE-001 <= 2 MiB; oversize image > 5 MiB). Matrix: 328 rows (case ID x environment row, CAP camera/mic split); every row NOT TESTED except rows with executed evidence records (GOV-01..03 PASS, ENV-01..03 BLOCKED, DATA-01..04 BLOCKED); validator passes. Per-environment scripts: written for the six host rows (not executed — executing them is DATA-02's work). Reset script: written but NOT executed or verified — it needs an org with seeded fixtures, which does not exist (SMF-2 BLOCKED). Outcome by the contract definitions: not PASS (the reset part has no executed result); not FAIL/PARTIAL (nothing executed fell short); BLOCKED because a prerequisite (org access) prevented executing the reset verification. |
| Outcome | BLOCKED |
| Evidence link | testing/fixtures/manifest.json; testing/MATRIX.md; testing/provisioning/apex/reset.apex; docs/test-scripts/README.md |
| Tester | Implementing agent (Claude Code cloud session); visual check of the images by the agent |
| Limitation / follow-up | Unblock: H1 + H2, stages 30-32, then `python3 testing/provisioning/fixtures.py reset --target-org smf-dev --reseed` and compare counts before/after. The oversize PNG is not in Git; regenerate with testing/fixtures/generate.py (hash in manifest). |
