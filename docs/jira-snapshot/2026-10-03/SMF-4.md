---
key: SMF-4
summary: "[04] Prove the minimal app launches for intended users on desktop and Salesforce mobile"
url: https://answersllc.atlassian.net/browse/SMF-4
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-4 [04] Prove the minimal app launches for intended users on desktop and Salesforce mobile

As a field technician, I want to open the internal app with my Salesforce account so that later capabilities are tested in the actual host.

**Backlog order:** 4 of 16 · **Track:** Foundation · **Reference:** POC-04

**Acceptance criteria**

1. Using the official Salesforce skills and scaffold selected under SMF-1, generate the minimal React UIBundle in the documented repository location and verify its build and lint checks before deployment.
2. Deploy a minimal internal employee React app with its CustomApplication and access permission set.
3. Verify intended-user launch, authenticated context, navigation/reload, and denial for a user without app access.
4. Run launch and navigation checks in desktop Salesforce and physical Salesforce mobile on both iOS and Android; record actual hosting context and versions.
5. Record unreachable devices as BLOCKED or NOT TESTED and provide exact human-run steps. A standalone mobile browser pass does not satisfy Salesforce mobile.

**Evidence / handoff**
Per-environment launch results and a host limitation decision before dependent device claims.

**Dependencies:** [SMF-2](https://answersllc.atlassian.net/browse/SMF-2), [SMF-3](https://answersllc.atlassian.net/browse/SMF-3)
Dependencies require supported findings or an explicit fallback/scope decision.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH and MF-SUPPORT; MF-RESTRICTED with app permission temporarily removed for the denial scenario.

**Test data / prerequisites:** MF-CASE-001; verified app permission baseline.

**Acceptance test checklist — record expected versus actual**

* HOST-01: Each intended user launches the deployed internal app, refreshes, navigates, and retains the correct authenticated context.
* HOST-02: RESTRICTED without the app permission cannot open the app; restore baseline after the test.
* HOST-03: Repeat on desktop Chrome/Edge and physical Salesforce mobile iOS/Android; capture host/version and failed launch behavior separately.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
