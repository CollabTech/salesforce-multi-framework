---
key: SMF-13
summary: "[13] Validate interactive 3D equipment rendering on desktop and mobile"
url: https://answersllc.atlassian.net/browse/SMF-13
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-13 [13] Validate interactive 3D equipment rendering on desktop and mobile

As a technician, I want to inspect a simple 3D equipment model so that support can identify the relevant component.

**Backlog order:** 13 of 16 · **Track:** Graphics · **Reference:** POC-13

**Acceptance criteria**

1. Use Three.js or React Three Fiber with a small redistributable equipment-like model; record library versions and model rights.
2. Test model load, orbit, zoom, part selection, reset, resize, and touch gestures in every defined host.
3. Measure load time and frame rate during a repeatable 60-second interaction; report scene complexity, device, and measurement method. Set the acceptable budget before judging performance.
4. Test unavailable graphics context, load failure, context loss, and remount; release resources and provide an accessible static-image fallback.

**Evidence / handoff**
Rendering/interaction/performance results by host; WebGL detection alone cannot earn PASS.

**Dependencies:** [SMF-4](https://answersllc.atlassian.net/browse/SMF-4)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH on desktop and physical mobile; MF-SUPPORT reviews selected-part behavior.

**Test data / prerequisites:** MF-MODEL-SMALL, missing-asset control, static equipment-image fallback.

**Acceptance test checklist — record expected versus actual**

* 3D-01: Load the small model, orbit/zoom/select/reset, rotate the device, and verify touch/resize behavior in each required host.
* 3D-02: Measure 60 seconds of repeatable interaction; initial target is usable within 10 seconds and median >=30 fps on the recorded device/network. Report measured values even when below target.
* 3D-03: Exercise missing model, unavailable/lost graphics context, and remount; verify a usable static-image fallback and released resources.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
