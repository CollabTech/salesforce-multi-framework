---
key: SMF-10
summary: "[10] Prove authorized equipment-image upload and retrieval through Salesforce Files"
url: https://answersllc.atlassian.net/browse/SMF-10
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-10 [10] Prove authorized equipment-image upload and retrieval through Salesforce Files

As a field technician, I want a case-linked equipment image in Salesforce Files so that authorized support can inspect it.

**Backlog order:** 10 of 16 · **Track:** Markup · **Reference:** POC-10

**Acceptance criteria**

1. Upload a synthetic equipment image and link it to the correct record through supported Salesforce data/file APIs.
2. Verify the authorized support user can retrieve it and the restricted user cannot; do not create a public file URL to avoid access checks.
3. Test supported image types/sizes, cancellation, failed upload/retry, and viewing after reauthentication in desktop and physical Salesforce mobile.
4. Document file/version identifiers and lifecycle privately as needed; the test must distinguish a browser-local file from a persisted Salesforce File.

**Evidence / handoff**
Cross-user upload/read/deny results and a retrievable case-linked Salesforce File.

**Dependencies:** [SMF-3](https://answersllc.atlassian.net/browse/SMF-3), [SMF-4](https://answersllc.atlassian.net/browse/SMF-4)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH uploads; MF-SUPPORT reads independently; MF-RESTRICTED attempts unauthorized access.

**Test data / prerequisites:** MF-CASE-001, MF-IMAGE-001, MF-CASE-002, MF-FILE-DENIED, MF-UPLOAD-INVALID.

**Acceptance test checklist — record expected versus actual**

* FILE-01: Upload the valid image, verify its correct record link, then read it as SUPPORT from a fresh session.
* FILE-02: RESTRICTED cannot retrieve it; TECH/SUPPORT cannot retrieve the negative-control File; there is no public-link workaround.
* FILE-03: Reject .txt and >5 MiB images cleanly, test cancel/failure/retry, and confirm retries do not create unintended duplicate attachments.
* FILE-04: Repeat the supported upload/view flow on physical Salesforce mobile iOS/Android as well as desktop.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
