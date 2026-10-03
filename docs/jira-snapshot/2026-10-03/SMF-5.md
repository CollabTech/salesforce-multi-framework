---
key: SMF-5
summary: "[05] Prove unlocked 2GP creation, clean installation, and a minimal upgrade"
url: https://answersllc.atlassian.net/browse/SMF-5
status_at_retrieval: To Discuss
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-5 [05] Prove unlocked 2GP creation, clean installation, and a minimal upgrade

As a subscriber administrator, I want a versioned package I can install and upgrade so that the public project is distributable.

**Backlog order:** 5 of 16 · **Track:** Foundation · **Reference:** POC-05

**Acceptance criteria**

1. Build the UIBundle and include the related internal-app and access metadata in an unlocked 2GP package; use verified packaging prerequisites.
2. Create a package version and install it into a separate suitable org with explicit target selection; retain operation IDs privately and sanitized reports publicly.
3. Assign intended access and verify the app launches from the subscriber org; document separately configured external services and credentials.
4. Create a small follow-up version and verify upgrade and activation behavior; preserve expected user data. Record unsupported steps as blockers rather than package success.

**Evidence / handoff**
Package create/install/upgrade evidence and a repeatable subscriber runbook.

**Dependencies:** [SMF-4](https://answersllc.atlassian.net/browse/SMF-4)
Dependencies require a supported result or an explicit recorded fallback/scope decision. Work remains limited to the assigned story and its specified prerequisites.

**Working agreement**
To Discuss → In Progress → Testing → Done. Use a blocked flag with reason and next action. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means the investigation and evidence were reviewed, not that the capability passed. Physical Salesforce mobile tests are required for mobile claims; mocks, emulation, and localhost are separate evidence. Never publish credentials or private/customer data.

**Repository:** https://github.com/CollabTech/salesforce-multi-framework

## Story test setup and Definition of Done

**Test users / actors:** MF-ADMIN installs; TECH/SUPPORT equivalents in the separate installation-test org verify behavior.

**Test data / prerequisites:** Minimal UIBundle package v1 and v2; independently seeded MF-CASE-001 baseline in the subscriber test org.

**Acceptance test checklist — record expected versus actual**

* PKG-01: Create/install unlocked v1, assign intended access, and verify a non-admin can launch the installed app.
* PKG-02: Install v2 over v1, verify activation/version behavior, and confirm the seeded case/file state is preserved.
* PKG-03: Repeat the app permission-denial scenario in the install-test org. Capture package operation reports and limitations without auth material.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
