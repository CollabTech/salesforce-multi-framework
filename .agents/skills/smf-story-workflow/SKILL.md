---
name: smf-story-workflow
description: "Use at the start of ANY task in the salesforce-multi-framework repo that implements, tests, or reviews a Jira SMF story (SMF-1..SMF-16). Covers reading the story, dependencies and SMF-3, resolving scope, selecting skills, Jira status moves, and the PR handoff."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# SMF story workflow

1. **Read**: the assigned story (Jira is authoritative; `docs/jira-snapshot/` is a dated
   fallback — say which you used), every story under its **Dependencies**, and SMF-3.
   Load the story's case IDs from `testing/test-plan-index.json` and the shared
   personas/fixtures/environments from `testing/contract.json`.
   Apply the **standing execution rule** in `AGENTS.md` §4: personas/fixtures are
   specifications until the owning story has verified evidence; provision them only
   through that owning story; delegated work comes back with evidence you verify.
2. **Resolve scope**: each dependency needs a supported result or a recorded
   fallback/scope decision. If not, record the gap (case ID, exact gap, smallest
   unblocking action), flag the Jira issue, and stop that case — do not start the dependency.
3. **Select skills** from the table in `AGENTS.md` §3 and list them in your plan.
4. **Plan tests before code**: for every case ID write persona pair, fixture IDs,
   environment rows, steps, expected result, and stop conditions
   (`evidence/TEMPLATE.md` fields). Do not invent personas or fixtures.
5. **Jira**: To Discuss → *In Progress* at start; *Testing* when implementation is in and
   evidence is pending/under review; *Done* only after evidence review. Blocked = Flagged
   + comment.
6. **Implement one probe** (`smf-capability-probe`), **verify**, **record evidence**
   (`smf-evidence`), and update the matrix (initialised by SMF-3).
7. **Handoff**: one draft PR per story containing a case-ID results table (expected vs
   actual, outcome, evidence link, tester), selected skills, limitations, and
   "completed vs outstanding". Run the checks in `AGENTS.md` §7 first.

Stop conditions (record and stop, don't improvise): missing licence/device/tool access,
org identity not verified, an instruction conflict, or a threshold that would need changing.
