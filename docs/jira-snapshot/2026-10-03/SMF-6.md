---
key: SMF-6
summary: "[06] Validate camera and microphone capture inside each Salesforce host"
url: https://answersllc.atlassian.net/browse/SMF-6
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-6 [06] Validate camera and microphone capture inside each Salesforce host

As a field technician, I want controlled camera and microphone access so that support can inspect an equipment problem.

**Backlog order:** 6 of 16 · **Track:** Realtime · **Reference:** POC-06

**Acceptance criteria**

1. On explicit user action, test camera-only, mic-only, and combined capture; report track state and failures clearly.
2. Test first-time approval, denial, later retry, unavailable device, and device switching where offered; stop all tracks on leave and unmount.
3. Run on the defined desktop and physical Salesforce mobile environments; capture permission-policy/CSP/host limitations without assuming browser API presence proves usability.
4. Store separate matrix results for camera and mic. Keep media transient and use synthetic scenes; do not silently record or upload.

**Evidence / handoff**
Capture/permission results by environment with recovery steps and any host-specific fallback.

**Dependencies:** [SMF-4](https://answersllc.atlassian.net/browse/SMF-4)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH performs capture; Brandon/device tester handles browser/OS permission prompts.

**Test data / prerequisites:** MF-ASSET-001 context and synthetic equipment scene; no recording persisted.

**Acceptance test checklist — record expected versus actual**

* CAP-01: From a user gesture, test camera-only, mic-only, and combined capture; verify actual tracks and preview/input activity.
* CAP-02: Deny/cancel permission, retry, simulate unavailable hardware, and switch devices where exposed; UI reports the real outcome.
* CAP-03: Leave/unmount and confirm capture stops. Repeat on every required host; record camera and mic results separately.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
