---
key: SMF-3
summary: "[03] Provision the defined test users, synthetic equipment data, and capability matrix"
url: https://answersllc.atlassian.net/browse/SMF-3
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-3 [03] Provision the defined test users, synthetic equipment data, and capability matrix

As a test lead, I want the already-defined personas, fixture data, and acceptance scenarios provisioned reproducibly so that every capability claim can be tested.

**Backlog order:** 3 of 16 · **Track:** Foundation · **Reference:** POC-03

**Acceptance criteria**

1. Provision or reconcile all defined logical roles: MF-ADMIN, MF-TECH, MF-SUPPORT, and MF-RESTRICTED. MF-RESTRICTED is required for denial tests. Verify licenses before creation; insufficient capacity blocks the affected cases rather than making that persona optional.
2. Seed synthetic equipment, a support case, and a sample equipment image with repeatable identifiers; verify rerunning setup does not duplicate records.
3. Define separate environments for desktop browser versions, physical Salesforce mobile on iOS and Android, and mobile Safari/Chrome. Emulation and localhost are separate evidence, never substitutes.
4. Initialize the matrix as NOT TESTED. Each result includes capability, actor pair, org/build reference, device/OS/app/browser versions, context, steps, expectation, observation, outcome, evidence, tester, date, and limitation.
5. Define PASS, FAIL, PARTIAL, BLOCKED, and NOT TESTED; enumerate camera, mic, playback, two-way A/V, screen sharing, Files, markup sync/persistence, 3D, recovery, and packaging.

**Evidence / handoff**
Runnable setup instructions, persona/access checks, and an empty but complete matrix; no invented device results.

**Dependencies:** [SMF-1](https://answersllc.atlassian.net/browse/SMF-1), [SMF-2](https://answersllc.atlassian.net/browse/SMF-2)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-ADMIN provisions; MF-TECH, MF-SUPPORT, and MF-RESTRICTED validate their own access.

**Test data / prerequisites:** All fixtures and persona grants in the shared test contract.

**Acceptance test checklist — record expected versus actual**

* DATA-01: Seed the data twice; counts and logical identities remain stable, with no duplicate test records.
* DATA-02: TECH and SUPPORT can access MF-CASE-001 and its image; RESTRICTED cannot. All business personas are denied MF-CASE-002 and MF-FILE-DENIED.
* DATA-03: Verify profiles/roles/sharing/permission sets match the intended baseline; store actual usernames and Salesforce/provider IDs privately.
* DATA-04: Generate the fixtures, hashes, cleanup/reset script, and per-environment test scripts. Populate all matrix rows as NOT TESTED until executed.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. The complete test contract is below.

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Shared test contract — defined now, provisioning still outstanding

DEFINED ONLY — test users and fixtures have not been provisioned or executed.

**Scenario:** A technician investigates overheating in synthetic pump MF-ASSET-001 while a remote support specialist diagnoses the same case.

**Test personas**

* **MF-ADMIN:** Provisioning and package install only; never use admin success to prove business-user access.
* **MF-TECH:** Non-admin field technician: app access, read/update assigned MF-CASE-001 and its equipment, create/read case-linked Files, join that case's call/markup room. No access to MF-CASE-002 or its Files/rooms.
* **MF-SUPPORT:** Separate non-admin remote support account: app access and read/update MF-CASE-001, read/create its Files, join its call/markup room. No access to MF-CASE-002 or its Files/rooms.
* **MF-RESTRICTED:** Separate non-admin negative-test user: app access but no case/asset/File/room access. For the app-visibility test only, remove app permission, verify denial, then restore the baseline. Reconcile profile, role, sharing, and permission-set grants so they do not accidentally bypass denial.

These are logical persona IDs, not existing usernames. Create org-unique usernames only after checking licenses and local username requirements; store the actual mapping privately. Use separate simultaneous sessions for TECH and SUPPORT. Reuse no business-user session as ADMIN. If licenses or devices are missing, mark affected cases BLOCKED rather than dropping the negative test.

**Synthetic test fixtures**

* **MF-ACCOUNT-001:** Synthetic customer: CollabTech PoC Test Customer.
* **MF-ASSET-001:** Synthetic equipment: pump MF-PUMP-001, assigned to the permitted case.
* **MF-CASE-001:** Open synthetic case: Pump overheating — remote diagnosis. Visible/editable only to TECH, SUPPORT, and setup ADMIN according to the defined grants.
* **MF-CASE-002:** Restricted synthetic case and linked asset MF-ASSET-002 owned outside all business test personas; negative control for records, Files, and room membership.
* **MF-IMAGE-001:** Generated/licensed synthetic equipment PNG/JPEG <=2 MiB, linked to MF-CASE-001; no people, customer data, or location metadata.
* **MF-FILE-DENIED:** A separate image linked only to MF-CASE-002 with no public link.
* **MF-UPLOAD-INVALID:** A .txt file and a >5 MiB image to exercise the PoC's image-only, 5 MiB upload limit. Any limit change requires an explicit project-owner decision recorded before the test.
* **MF-ROOM-001 / MF-ROOM-002:** Logical media/markup rooms bound to the permitted/restricted case respectively. Provider room IDs and short-lived participant credentials stay private; server-side authorization must bind the caller to the case.
* **MF-MARKUP-001:** Image MF-IMAGE-001 plus two independent annotations: TECH creates a red circle over the inlet; SUPPORT creates an arrow and text 'Inspect inlet'. Snapshot and export must preserve both.
* **MF-MODEL-SMALL / MF-MODEL-REP:** Redistributable equipment-like GLB models, small <=2 MiB and representative <=10 MiB. Record actual triangle/texture counts, asset provenance, and hash when fixtures are generated. Include a missing-asset path for failure tests.

Implement these logical records using the target org's verified schema and supported APIs; do not invent field names. Keep org record-ID mapping private. Seed is idempotent, baseline permissions are verified, and reset restores the known fixture state without touching non-PoC records. No fixtures are claimed to exist yet.

**Required environment coverage**
Desktop Chrome and Edge (record exact versions), physical Salesforce mobile iOS and Android (record device/OS/Salesforce app versions), and mobile Safari/Chrome as separate exploratory rows. State the runtime origin/hosting context and build/commit. Missing a required device is BLOCKED/NOT TESTED, never a desktop-derived PASS.

**Who performs testing**
The implementing agent creates the probe, seed/permission setup, meaningful automation, and manual script. This planning/testing assistant helps review criteria and evidence and runs accessible checks. Brandon or an explicitly designated tester performs passkey/permission interactions, physical-device actions, and subjective audio/video checks that automation cannot attest to. Mark who actually performed each test.

**Evidence fields**
Record test-case ID, persona pair, fixture IDs/hash/version, build/commit, host/device/OS/app/browser version, timestamp, preconditions, steps, expected and actual results, outcome, sanitized evidence link, tester, and follow-up limitation.

**Acceptance targets**
Limits and performance targets in individual stories are initial PoC test targets, not claims of existing capability or vendor guarantees. Any adjustment requires an explicit project-owner decision recorded with its rationale before evaluating the run; never relax a target after a failure to manufacture a pass.

**Shared Definition of Done**
All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

## Fixture provisioning ownership

SMF-3 provisions the baseline users/grants, synthetic customer/equipment/cases, baseline image Files, and reusable local fixture specifications/assets and matrix. It verifies available baseline record/File access using supported platform interfaces. App-specific permission checks execute when SMF-4 provides the app. MF-ROOM-001/002 are case-binding specifications here; provider room/token setup belongs to SMF-7 and collaboration-service setup to SMF-12. MF-MARKUP-001 describes the expected annotations; actual saved snapshot/export artifacts are produced and checked in SMF-11/12. 3D fixtures are created or reconciled when required by SMF-13/14. Do not pretend service-specific fixtures already exist or make baseline provisioning depend on unbuilt PoCs.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
