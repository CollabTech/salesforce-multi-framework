---
key: SMF-9
summary: "[09] Validate call recovery during mobile and network interruptions"
url: https://answersllc.atlassian.net/browse/SMF-9
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-9 [09] Validate call recovery during mobile and network interruptions

As a mobile technician, I want clear recovery after an interruption so that support knows when communication is lost.

**Backlog order:** 9 of 16 · **Track:** Realtime · **Reference:** POC-09

**Acceptance criteria**

1. Test temporary network loss and recovery, network change, app background/foreground, screen lock/unlock, and an incoming-call interruption on available physical devices.
2. Record time to reconnect, room/participant state, and whether audio/video permissions or user gestures are needed again.
3. Verify leave/rejoin does not produce duplicate participants or orphaned local media tracks; cancellation remains available.
4. Repeat the same scenario three times per tested environment, report variability, and document manual recovery when automatic recovery fails.

**Evidence / handoff**
Interruption test log and explicit PARTIAL/FAIL results; no claim of uninterrupted background capture.

**Dependencies:** [SMF-7](https://answersllc.atlassian.net/browse/SMF-7)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH on a physical mobile device + MF-SUPPORT on desktop; device tester performs interruptions.

**Test data / prerequisites:** Active MF-ROOM-001 call and a fixed synthetic visual/audio test script.

**Acceptance test checklist — record expected versus actual**

* REC-01: Repeat network loss/recovery and network switching three times; record disconnect detection, recovery time, restored A/V, and duplicate participants.
* REC-02: Repeat background/foreground and lock/unlock three times; exercise an incoming-call interruption where feasible.
* REC-03: Verify explicit leave/rejoin recovery and that local media stops on leave. Any unperformed interruption remains BLOCKED/NOT TESTED.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
