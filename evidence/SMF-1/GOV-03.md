# GOV-03 — repository — diff, provenance and test-plan integrity review

> Historical record (before the PR #1 review). Current result: `GOV-03-portability.md`.

| Field | Value |
|---|---|
| Case ID | GOV-03 |
| Story | SMF-1 |
| Persona pair | Implementing agent; Brandon (review) |
| Fixture IDs / hash / version | Test-plan index v1.1.0 built from `docs/jira-snapshot/2026-10-03/` |
| Build / commit | SMF-1 PR head (see PR); checks re-run on the final head before push |
| Host / device / OS / app / browser | Linux cloud container; Python 3 |
| Environment row | n/a — repository check |
| Timestamp | Run 2: 2026-10-03T21:10Z. Run 1: 2026-10-03T18:50Z |
| Preconditions | All SMF-1 files committed |
| Steps | 1. `python3 scripts/scan-public-content.py`. 2. Read the full diff of non-vendored files by eye. 3. `python3 scripts/check-test-plan.py`. 4. Negative checks in a scratch clone: duplicate a case ID; drop a case ID; reference an undefined fixture in a story's test data and blank a story's evidence text; add a file with an sfdx auth URL and an org ID. 5. Fetch the live Jira description of SMF-1..SMF-16 and diff against the snapshot; compare live case IDs with the index. 6. Confirm no repository or Jira project/board was created. |
| Expected result | "Review the diff and curated provenance for accidental credentials/private data; verify the task does not recreate the existing repository or Jira board." Additionally: "every indexed test case resolves to its owning story and none is omitted or duplicated." |
| Actual result | 1: `OK: no credential or private-identifier patterns found` (28 official skill folders excluded because their bytes are hash-verified against public upstream). 2: no credentials, tokens, org IDs, real test usernames or private conversations; the only personal data is the project owner's first name as written in the public stories. 3: `OK: 16 stories, 54 case IDs, each owned by exactly one story; raw snapshot scan agrees; persona/fixture references resolve.` The index now also carries each story's verbatim test users, test data and required-evidence text and its persona/fixture IDs, all resolving to `testing/contract.json`. 4: duplicate → FAIL (`GOV-01` owned by SMF-1 and SMF-2; 55 ≠ 54); drop → FAIL (`DATA-04 appears in SMF-3.md but is not indexed`); undefined fixture / blank evidence → FAIL naming `MF-ROOM-999` and SMF-4; secrets → FAIL for both; all restored. 5: live descriptions of all 16 stories identical to the 2026-10-03 snapshot; live checklist has 54 IDs, none missing, extra, or with a different owner (spot-checked SMF-1/3/7 by independent diff). 6: no repository, Jira project, board or issue created. The existing repo had no base branch, so an empty root commit was pushed as `main` and merged (not rebased) into the SMF-1 branch to allow a PR; nothing was rewritten. Jira: only SMF-1 status/comments touched. |
| Outcome | PASS |
| Evidence link | this record; `scripts/check-test-plan.py`; `scripts/scan-public-content.py`; `scripts/build-test-plan-index.py` |
| Tester | Implementing agent. Review: Brandon (pending — the human diff review is part of this case) |
| Limitation / follow-up | The scanner is heuristic. Redistribution licence question C-02 is open. The repository default branch is still the SMF-1 branch; switching it to `main` is a repository-settings action for the owner. |
