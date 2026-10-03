---
name: smf-evidence
description: "Use when recording, updating, or summarising test results for any SMF case ID: evidence record fields, PASS/FAIL/PARTIAL/BLOCKED/NOT TESTED definitions, and the Definition of Done."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Evidence and outcomes

One record per case ID per environment run: `evidence/SMF-<n>/<CASE-ID>.md`, from
`evidence/TEMPLATE.md`. Required fields (SMF-3): case ID, persona pair, fixture
IDs/hash/version, build/commit, host/device/OS/app/browser version, timestamp,
preconditions, steps, expected, actual, outcome, sanitized evidence link, tester, limitation.

**Outcomes** (capability results — not Jira columns):
- **PASS** — actual matches expected for the declared environment, evidenced.
- **FAIL** — executed; actual does not meet expected.
- **PARTIAL** — executed; some required behaviour works, some doesn't (say which).
- **BLOCKED** — could not execute; name the missing prerequisite and the unblocking action.
- **NOT TESTED** — not yet executed. Default for every row.

**Rules**
- Never write an outcome without an executed run. Specifications are not results.
- Mocked tests and successful builds are supporting evidence, not PASS.
- Report measured values even when below target; don't re-run until it passes without
  recording every run.
- Evidence is sanitized: no tokens, real usernames, org/record/room IDs, faces, or
  customer data in screenshots/recordings.

**Definition of Done** (story level): every listed case has an actual result for the
declared scope; code/PR and evidence reviewed; matrix updated; nothing private published.
A reviewed FAIL/PARTIAL with a documented decision can be Done. A missing required test
keeps the story in Testing/blocked unless Brandon explicitly accepts reduced scope, with
the excluded coverage still visible.
