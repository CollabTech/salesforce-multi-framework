---
key: SMF-12
summary: "[12] Prove two-user live tldraw collaboration with durable recovery"
url: https://answersllc.atlassian.net/browse/SMF-12
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-12 [12] Prove two-user live tldraw collaboration with durable recovery

As the technician and support specialist, we want to mark the same equipment image together so that our instructions stay aligned.

**Backlog order:** 12 of 16 · **Track:** Markup · **Reference:** POC-12

**Acceptance criteria**

1. Use an authenticated collaboration service; Salesforce Files is durable image/snapshot storage, not an assumed real-time synchronization transport.
2. Verify two independent sessions see each other's edits, presence, and concurrent shape changes; measure propagation delay and record conflicts.
3. Disconnect and reconnect one client; verify the agreed document state and associated assets survive reconnect and server restart under the chosen persistence design.
4. Deny unauthorized room joins and file access, including after access changes; never use a public demo room for private Salesforce content.
5. Exercise desktop/mobile collaboration and simultaneous save/version behavior; document any remaining conflict-resolution limitations.

**Evidence / handoff**
Two-user sync/recovery evidence and an architecture decision separating live state from Files persistence.

**Dependencies:** [SMF-11](https://answersllc.atlassian.net/browse/SMF-11)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH + MF-SUPPORT simultaneously; MF-RESTRICTED for denied joins.

**Test data / prerequisites:** MF-ROOM-001, MF-MARKUP-001, Salesforce image/snapshot Files; wrong-case room control.

**Acceptance test checklist — record expected versus actual**

* SYNC-01: Independently create the circle and arrow/text; both sessions converge and show presence. Measure propagation delay; initial PoC target is <=2 seconds on a recorded stable network.
* SYNC-02: Perform concurrent edits, disconnect/reconnect one client, and restart the collaboration service under the chosen persistence design; verify the agreed state/assets recover.
* SYNC-03: Deny restricted/wrong-case room and asset access; test revoked access and document the actual enforcement timing.
* SYNC-04: Run desktop↔physical mobile pairs and verify final Salesforce snapshot/version association. Record missed targets as FAIL/PARTIAL, not hidden exceptions.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
