---
key: SMF-7
summary: "[07] Prove authorized RealtimeKit two-person audio and video"
url: https://answersllc.atlassian.net/browse/SMF-7
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-7 [07] Prove authorized RealtimeKit two-person audio and video

As a technician and support specialist, we want to see and hear each other so that we can diagnose the same equipment remotely.

**Backlog order:** 7 of 16 · **Track:** Realtime · **Reference:** POC-07

**Acceptance criteria**

1. Use Cloudflare RealtimeKit and a server-side authorization/token boundary; never expose account API secrets in browser bundles or public logs.
2. Verify authorized room membership and deny unauthorized room access; test invalid or expired participant authorization.
3. Run a 5-minute bidirectional call between independent technician/support sessions, checking audible audio, visible video, mute/unmute, camera toggle, join, and leave.
4. Test desktop-to-desktop and desktop-to-physical Salesforce mobile on iOS and Android; record one-way audio, autoplay restrictions, disconnects, and remote playback separately.
5. Report any account, plan, licensing, or endpoint configuration prerequisites before enabling paid services.

**Evidence / handoff**
Two-party call evidence, authorized/denied membership results, and a matrix with separate send/receive outcomes.

**Dependencies:** [SMF-3](https://answersllc.atlassian.net/browse/SMF-3), [SMF-6](https://answersllc.atlassian.net/browse/SMF-6)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-TECH + MF-SUPPORT in independent simultaneous sessions; MF-RESTRICTED for authorization failure.

**Test data / prerequisites:** MF-CASE-001, MF-ROOM-001; MF-ROOM-002, invalid and expired participant authorization as negative controls.

**Acceptance test checklist — record expected versus actual**

* CALL-01: TECH/SUPPORT join MF-ROOM-001 for five minutes; each reads a short test phrase heard by the other and displays a changing visual marker visible remotely.
* CALL-02: Verify mute/unmute, camera toggle, join and leave; record send and receive separately for desktop↔desktop and desktop↔physical Salesforce mobile iOS/Android.
* CALL-03: RESTRICTED and wrong-case users cannot obtain/join the room; expired/invalid authorization is rejected without leaking credentials.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
