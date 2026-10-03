# GOV-03 — n/a — repository check — diff, provenance and test-plan integrity after the review corrections (run 3)

| Field | Value |
|---|---|
| Case ID | GOV-03 |
| Story | SMF-1 |
| Persona pair | Implementing agent; independent reviewer agent |
| Fixture IDs / hash / version | Test-plan index v1.1.0 (paths now POSIX on every OS) |
| Build / commit | b79111a |
| Host / device / OS / app / browser | Linux cloud container; Python 3.11 |
| Environment row | n/a — repository check |
| Timestamp | 2026-10-03T21:34Z–21:44Z |
| Preconditions | Official skill folders and .claude/skills untracked (git ls-files .agents .claude lists only the 7 smf-* SKILL.md files) |
| Steps | 1. check-test-plan.py, scan-public-content.py in a fresh clone 2. Negatives: duplicated case ID; dropped case ID; Windows backslash path written into the index; planted sfdx auth URL + org ID 3. Unit test: index paths from a PureWindowsPath root are POSIX; Markdown contains no backslashes 4. autocrlf=true clone with forced-CRLF index/snapshot/evidence files: check-test-plan 5. Diff review of ade0d97..b79111a |
| Expected result | Review the diff and curated provenance for accidental credentials/private data; verify the task does not recreate the existing repository or Jira board; every indexed test case resolves to its owning story and none is omitted or duplicated. |
| Actual result | All checks OK; each negative FAILs as expected (duplicate: GOV-01 owned twice, 55≠54; drop: DATA-04 not indexed; backslash: 'non-portable path in index'; secrets: both flagged). Vendor skill copies are no longer tracked at the branch head; they remain in the branch's earlier commits, so PR #1 must be squash-merged (recorded in ADR-0001 rev 2 and C-02). No repository, Jira project or board created. |
| Outcome | PASS |
| Evidence link | evidence/SMF-1/logs/gov-portability-2026-10-03.txt; scripts/check-test-plan.py |
| Tester | Implementing agent; independent review by a separate reviewer agent (PR comment). Brandon: not performed |
| Limitation / follow-up | Scanner is heuristic. Branch history still contains vendor copies until squash-merge. |
