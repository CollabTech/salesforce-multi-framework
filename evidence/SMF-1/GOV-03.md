# GOV-03 — repository — diff, provenance and test-plan integrity review

| Field | Value |
|---|---|
| Case ID | GOV-03 |
| Story | SMF-1 |
| Persona pair | Implementing agent; Brandon (review) |
| Fixture IDs / hash / version | Test-plan index v1.0.0 built from `docs/jira-snapshot/2026-10-03/` |
| Build / commit | SMF-1 PR head (see PR) |
| Host / device / OS / app / browser | Linux cloud container; Python 3 |
| Environment row | n/a — repository check |
| Timestamp | 2026-10-03T18:50Z |
| Preconditions | All SMF-1 files committed |
| Steps | 1. `python3 scripts/scan-public-content.py`. 2. Read the full diff of non-vendored files by eye. 3. `python3 scripts/check-test-plan.py`. 4. Negative checks: add a duplicated case ID to the index; add a file with an sfdx auth URL and an org ID. 5. Confirm no repository or Jira project/board was created. |
| Expected result | "Review the diff and curated provenance for accidental credentials/private data; verify the task does not recreate the existing repository or Jira board." Additionally: "every indexed test case resolves to its owning story and none is omitted or duplicated." |
| Actual result | 1: `OK: no credential or private-identifier patterns found` (28 official skill folders excluded because their bytes are hash-verified against public upstream; their examples use placeholder IDs). 2: no credentials, tokens, org IDs, real test usernames or private conversations; the only personal data is the project owner's first name as written in the public stories. 3: `OK: 16 stories, 54 case IDs, each owned by exactly one story; raw snapshot scan agrees; persona/fixture references resolve.` 4: duplicate → FAIL (`GOV-01` owned by SMF-1 and SMF-2; 55 ≠ 54); secrets → FAIL for both; restored. 5: the existing remote `CollabTech/salesforce-multi-framework` had no commits; work is one branch + draft PR on it. Jira: only SMF-1's status/comment were touched; no project, board or issue created. |
| Outcome | PASS |
| Evidence link | this record; `scripts/check-test-plan.py`; `scripts/scan-public-content.py` |
| Tester | Implementing agent. Review: Brandon (pending — the human diff review is part of this case) |
| Limitation / follow-up | The scanner is heuristic. Redistribution licence question C-02 is open for the owner. |
