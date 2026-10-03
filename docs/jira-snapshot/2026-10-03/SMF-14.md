---
key: SMF-14
summary: "[14] Evaluate 3D asset delivery and practical performance limits"
url: https://answersllc.atlassian.net/browse/SMF-14
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-14 [14] Evaluate 3D asset delivery and practical performance limits

As a support specialist, I want a known rendering budget so that equipment models remain usable on field devices.

**Backlog order:** 14 of 16 · **Track:** Graphics · **Reference:** POC-14

**Acceptance criteria**

1. Compare a small and a representative larger model with recorded file size, mesh/texture complexity, load time, frame rate, and available memory indicators.
2. Verify the chosen authenticated asset-delivery path; if using Salesforce Files, test retrieval and restricted-user denial for model assets and textures.
3. Test repeat open/close cycles, orientation changes, and mobile foreground recovery; record crashes or degradation.
4. Define the maximum tested scene budget and fallback trigger; do not generalize to untested model sizes or devices.

**Evidence / handoff**
Measured operating envelope and a go/defer decision for 3D in the vertical slice.

**Dependencies:** [SMF-10](https://answersllc.atlassian.net/browse/SMF-10), [SMF-13](https://answersllc.atlassian.net/browse/SMF-13)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH on the target field devices; MF-RESTRICTED for protected asset delivery.

**Test data / prerequisites:** MF-MODEL-SMALL and MF-MODEL-REP with hashes, sizes, mesh/texture counts; protected asset negative control.

**Acceptance test checklist — record expected versus actual**

* BUDGET-01: Compare the two models using the same load/60-second interaction protocol and record device/network measurements.
* BUDGET-02: Open/close each model five times and test orientation plus foreground recovery; record errors, context loss, and available resource measurements.
* BUDGET-03: Verify authorized delivery of model and textures and denial for RESTRICTED if Files is used; report any asset path that bypasses access checks.
* BUDGET-04: Publish the maximum tested scene budget and fallback trigger from the results; do not claim a larger untested operating range.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
