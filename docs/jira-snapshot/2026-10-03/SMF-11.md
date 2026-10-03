---
key: SMF-11
summary: "[11] Prove tldraw equipment markup and Salesforce Files save/reopen"
url: https://answersllc.atlassian.net/browse/SMF-11
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-11 [11] Prove tldraw equipment markup and Salesforce Files save/reopen

As a technician or support specialist, I want equipment markup to survive closing the app so that diagnostic work can be resumed.

**Backlog order:** 11 of 16 · **Track:** Markup · **Reference:** POC-11

**Acceptance criteria**

1. Load the authorized Salesforce equipment image into tldraw and annotate using mouse and touch; check zoom/pan and readable callouts.
2. Persist an editable snapshot and an exported annotated image to Salesforce Files with record linkage and explicit version association.
3. Reopen from a fresh session and verify shapes, image assets, and record context are restored without relying on browser-local storage.
4. Exercise failed save/retry and concurrent save conflicts without silently overwriting another version; verify file access restrictions.
5. Record tldraw licensing and asset-hosting requirements and keep production use gated on an appropriate license.

**Evidence / handoff**
Round-trip snapshot/export evidence with authorized-user and denial checks.

**Dependencies:** [SMF-10](https://answersllc.atlassian.net/browse/SMF-10)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH authors, MF-SUPPORT reopens, MF-RESTRICTED attempts denied access.

**Test data / prerequisites:** MF-IMAGE-001 and MF-MARKUP-001; linked editable snapshot and export.

**Acceptance test checklist — record expected versus actual**

* MARK-01: Use mouse and mobile touch to create the prescribed circle, arrow, and label; verify pan/zoom and readable annotation positioning.
* MARK-02: Save snapshot/export to Files, close the session, and reopen as SUPPORT; image and all annotations persist without browser-local state.
* MARK-03: Fail/retry a save and attempt concurrent versions; preserve existing versions or show an explicit conflict rather than silent data loss.
* MARK-04: Verify restricted users cannot retrieve the underlying image, snapshot, or export.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
