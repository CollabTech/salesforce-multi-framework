---
key: SMF-16
summary: "[16] Compose and package the proven remote-support vertical slice"
url: https://answersllc.atlassian.net/browse/SMF-16
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-16 [16] Compose and package the proven remote-support vertical slice

As a field technician, I want to open an equipment case, collaborate with support, and save the diagnostic result through one coherent flow.

**Backlog order:** 16 of 16 · **Track:** Vertical slice · **Reference:** POC-16

**Acceptance criteria**

1. Compose only approved capabilities: open the case/equipment context, join support, view or share an image, annotate, optionally inspect 3D, and save the outcome.
2. Present permission failures, unavailable capabilities, disconnects, and save errors with the approved fallbacks.
3. Run the full acceptance scenario with separate technician/support users on each supported desktop/mobile environment; verify record and file access end-to-end.
4. Build and install the unlocked package in the separate test org; repeat the end-to-end flow there and publish a curated demo, limitations, and setup guide.
5. Keep unsupported hosts and capabilities explicitly excluded rather than declaring universal mobile compatibility.

**Evidence / handoff**
Reviewed PR and package evidence with a complete workflow demonstration for the declared support matrix.

**Dependencies:** [SMF-15](https://answersllc.atlassian.net/browse/SMF-15)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH + MF-SUPPORT on declared supported hosts; MF-RESTRICTED for negative checks; MF-ADMIN installs only.

**Test data / prerequisites:** MF-CASE-001, MF-ASSET-001, MF-IMAGE-001, MF-ROOM-001, MF-MARKUP-001, optional approved 3D model; equivalent subscriber-org fixture set.

**Acceptance test checklist — record expected versus actual**

* E2E-01: TECH opens the case, SUPPORT joins, both communicate, inspect/annotate the image, use 3D only if approved, and save the diagnostic outcome.
* E2E-02: SUPPORT reopens the saved outcome in a fresh session; RESTRICTED cannot access the case, room, or resulting Files.
* E2E-03: Exercise approved permission/network/save-error fallbacks on each supported host and repeat the complete scenario after installation in the separate test org.
* E2E-04: Publish the curated demo and explicit supported/unsupported matrix; no universal mobile claim and no unpublished test evidence.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
