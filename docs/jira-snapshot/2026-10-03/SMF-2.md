---
key: SMF-2
summary: "[02] Confirm the org can host Multi-Framework and own unlocked packages"
url: https://answersllc.atlassian.net/browse/SMF-2
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-2 [02] Confirm the org can host Multi-Framework and own unlocked packages

As a project maintainer, I want verified Salesforce prerequisites so that PoC work starts on a supported platform.

**Backlog order:** 2 of 16 · **Track:** Foundation · **Reference:** POC-02

**Acceptance criteria**

1. Read and apply the accepted agent rules and skill configuration from SMF-1 before performing environment work.
2. Verify the actual org identity and edition; record sanitized CLI/tool versions and current platform requirements.
3. Verify Dev Hub and unlocked 2GP settings, capacity, Hyperforce, Salesforce app domain, Edge requirements, and the API version needed for UIBundle packaging; distinguish observed settings from assumptions.
4. Choose an explicit development org and a separate installation-test org; document their creation/reuse steps and blockers without treating the Dev Hub as the application test environment.
5. Keep authentication in the local credential store; public evidence contains no passwords, passkeys, tokens, private org identifiers, or production data.

**Evidence / handoff**
Environment readiness report with PASS/BLOCKED for each prerequisite; do not claim packaging works until story 05.

**Dependencies:** [SMF-1](https://answersllc.atlassian.net/browse/SMF-1)
Dependencies require supported findings or an explicit fallback/scope decision.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-ADMIN for setup; Brandon for passkey or required interactive authorization.

**Test data / prerequisites:** Existing Developer org; completed repo/board baseline; private org-identity mapping.

**Acceptance test checklist — record expected versus actual**

* ENV-01: Authenticate and verify the actual org identity/edition before any writes; independently verify Dev Hub, unlocked 2GP, and the current Multi-Framework prerequisites.
* ENV-02: Record scratch-org/package capacity and licenses sufficient for the defined test personas; shortages produce explicit blockers.
* ENV-03: Document separate dev/install-test targets and the repeatable setup path. Report each readiness item as observed PASS/BLOCKED; do not claim a package has been tested.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
