---
key: SMF-15
summary: "[15] Review the capability matrix and select the supported workflow"
url: https://answersllc.atlassian.net/browse/SMF-15
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-15 [15] Review the capability matrix and select the supported workflow

As the product owner, I want an evidence-based scope decision so that the polished experience uses capabilities that actually work.

**Backlog order:** 15 of 16 · **Track:** Decision · **Reference:** POC-15

**Acceptance criteria**

1. Review all required device/host rows, evidence links, and unresolved gaps; document FAIL and PARTIAL results as legitimate PoC findings.
2. Separate a completed investigation from a supported capability. BLOCKED/NOT TESTED required cells prevent claims of full validation; consciously deferred coverage requires a recorded scope decision.
3. Choose the supported host/device set and explicit fallbacks for media, markup, and graphics; record decisions and why excluded capabilities are deferred.
4. Review service cost assumptions, external prerequisites, licensing, permission boundaries, and synthetic-data handling before composition.

**Evidence / handoff**
Accepted decision record linking each included capability to test evidence and each limitation to a user-visible fallback.

**Dependencies:** [SMF-5](https://answersllc.atlassian.net/browse/SMF-5), [SMF-8](https://answersllc.atlassian.net/browse/SMF-8), [SMF-9](https://answersllc.atlassian.net/browse/SMF-9), [SMF-12](https://answersllc.atlassian.net/browse/SMF-12), [SMF-14](https://answersllc.atlassian.net/browse/SMF-14)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** Brandon as scope decision-maker; implementing agent and testing assistant present evidence.

**Test data / prerequisites:** All matrix rows and evidence from SMF-4 through SMF-14; no new user accounts.

**Acceptance test checklist — record expected versus actual**

* GATE-01: Check every planned capability/environment row against actual evidence, persona, fixture, build, and tester; reject unsupported PASS claims.
* GATE-02: Choose supported devices/capabilities and named fallbacks; record exclusions and any explicit reduced-scope decision.
* GATE-03: Confirm packaging, licensing, service prerequisites, and access-control findings before allowing SMF-16 to start.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
