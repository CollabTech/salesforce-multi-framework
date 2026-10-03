---
key: SMF-1
summary: "[01] Establish official skills, agent rules, and repository working structure"
url: https://answersllc.atlassian.net/browse/SMF-1
status_at_retrieval: In Progress
retrieved: 2026-10-03
source: Jira description field, exported as Markdown via the Atlassian connector
---

<!-- Read-only snapshot. Jira is authoritative; do not edit. Re-snapshot into a new dated folder. -->

# SMF-1 [01] Establish official skills, agent rules, and repository working structure

As the project owner, I want the agent's skills, instructions, and working structure established first so that every subsequent Salesforce and PoC task follows a consistent, reviewable process.

**Already completed — context, not work to repeat**

* Public repository: https://github.com/CollabTech/salesforce-multi-framework
* Repository connected to the coding workspace by the project owner.
* Jira project SMF, the four-status workflow, and the initial prioritized stories/dependencies.

**Remaining scope:** Configure the agent's skills, rules, and working structure inside the existing repository. Do not recreate the repo, Jira project, or board.

**Backlog order:** 1 of 16 · **Track:** Foundation · **Reference:** POC-01

**Acceptance criteria**

1. Use the existing public repository https://github.com/CollabTech/salesforce-multi-framework. Repository creation and public visibility are already completed; do not create a replacement repository or repeat that setup. Inspect existing contents and add only missing agent guidance, architecture-decision templates, PoC briefs, acceptance-test/evidence structure, and curated provenance. Document where the official Salesforce app scaffold will be generated later; this story does not require a configured org or deployed app.
2. Install or configure the applicable official Salesforce skills at project scope using their supported mechanism; record upstream source and revision, explain how contributors load them, and verify that the chosen coding agent can discover and read them. Do not invent vendor skill names or silently rely on machine-global installations.
3. Add root AGENTS.md with the remote field/support use case, internal React UIBundle and unlocked 2GP direction, the role of official versus project-specific skills, and clear instructions for selecting the relevant skill before work.
4. Add concise project-specific skills or instructions for bounded capability probes, Salesforce integration boundaries, physical-mobile testing, pass/fail/partial evidence, review, and public provenance. Keep vendor guidance authoritative for platform mechanics.
5. Define the task lifecycle: read the Jira story and applicable instructions; resolve scope and dependencies; prepare acceptance tests; implement one probe; verify; attach evidence and limitations; update the matrix; submit a reviewable PR and handoff. Use To Discuss → In Progress → Testing → Done, with a blocked flag when needed.
6. Require explicit org targeting and synthetic test data; keep secrets, authentication exports, raw private conversations, and customer data out of Git and public agent logs. Preserve curated task instructions, decisions, changes, and verification results.
7. Define Done separately from capability PASS: failures and partial support are valid findings when evidenced and reviewed. Never infer Salesforce mobile support from localhost, desktop, mobile-browser, or emulator results.
8. Demonstrate instruction discovery with a bounded dry run: the agent reads AGENTS.md, selects the relevant official/project skills for the Salesforce-readiness story, and produces the expected test/evidence plan without changing an org. Include this evidence and contributor instructions for the remaining setup in the PR; distinguish completed project setup from outstanding work.

**Evidence / handoff**
Reviewed governance/bootstrap PR, project-scoped official skills provenance, verified agent instruction discovery, and a dry-run handoff for SMF-2. This story must be accepted before Salesforce setup or PoC implementation begins.

**Dependencies:** None

**Working agreement**
To Discuss → In Progress → Testing → Done. Capability results are separate: NOT TESTED / PASS / FAIL / PARTIAL / BLOCKED. Done means evidence was reviewed, not that the capability passed. Keep public evidence free of secrets and private/customer data.

## Story test setup and Definition of Done

**Test users / actors:** Implementing agent + Brandon/reviewer; no Salesforce user or org mutation required.

**Test data / prerequisites:** Existing public Git repo, existing SMF board, the current stories, official skills source/revision.

**Acceptance test checklist — record expected versus actual**

* GOV-01: In a fresh contributor session, follow repo instructions; verify official/project skills can be discovered and loaded without undocumented machine-global dependencies.
* GOV-02: Dry-run SMF-2 planning and verify selected skills, explicit target-org requirement, persona/fixture references, evidence template, and stop conditions are present.
* GOV-03: Review the diff and curated provenance for accidental credentials/private data; verify the task does not recreate the existing repository or Jira board.

**Required evidence and completion:** All listed acceptance scenarios have actual results for the declared test scope; code/PR and evidence are reviewed; matrix is updated; no secrets or private/customer data are published. PASS/FAIL/PARTIAL are capability outcomes, not board columns. A PoC may be Done with a reviewed FAIL/PARTIAL and a documented decision. A missing required test keeps it in Testing or blocked unless Brandon explicitly accepts reduced scope and the excluded coverage remains visible. A successful build or mocked test alone is not Done.

Record case ID, actors, fixture version, build, host/device versions, timestamp, expected/actual result, outcome, evidence link, and who tested it. Use the persona grants, fixture definitions, environment matrix, and testing responsibilities in [SMF-3](https://answersllc.atlassian.net/browse/SMF-3).

**Testing assistance:** The implementing agent supplies repeatable tests and sanitized results. This assistant reviews evidence and runs checks available through its tools; Brandon or a designated device tester performs physical-device actions and audio/video observations. Missing device/tool access is a recorded blocker.

## Required Jira-to-repository handoff

AGENTS.md must instruct agents to read the assigned Jira story, its named dependencies, and SMF-3 before acting. Add a versioned test-plan index linking SMF-1 through SMF-16 and all 54 existing case IDs to their authoritative Jira descriptions. Capture the agreed logical personas, fixture definitions, environment coverage, expected outcomes, evidence fields, and Definition of Done in a reusable repository manifest with source-story links and retrieval date. Preserve the existing definitions; flag contradictions instead of silently rewriting them. Store no real usernames, org IDs, or credentials in the public manifest.

GOV-02 additionally verifies that a fresh agent following only AGENTS.md can locate SMF-2's ENV-01–ENV-03 tests and SMF-3's shared test contract. GOV-03 additionally checks every indexed test case resolves to its owning story and none is omitted or duplicated. The manifest contains specifications, not fabricated execution results. Executable provisioning and capability tests are implemented under their owning stories.

## Agent execution contract

Before implementation, read this entire story, its named dependency issues, and [SMF-3: shared personas, fixtures, and evidence contract](https://answersllc.atlassian.net/browse/SMF-3). The numbered acceptance criteria and named test-case IDs in this story define the work. This is not an open-ended product-design assignment.

Provision or reconcile the specified users, grants, and synthetic fixtures needed by this story's test cases in the verified test environment. Use the implementation/provisioning story that owns each prerequisite and record its outcome there. Reuse verified existing setup. Do not invent personas, replace the defined fixtures, omit denial tests, change thresholds, mark missing evidence PASS, or start unrelated backlog stories. Delegation, if used, must name the exact story/test-case IDs, personas, fixtures, expected outcomes, and returned evidence; the assigned agent retains verification responsibility.

If a concrete prerequisite is unavailable or two instructions conflict, record the affected test-case ID, the exact gap, and the smallest action needed to unblock it. Do not ask the project owner to design the users, data, or test cases already specified here. Requests for human participation must identify a specific required interaction or observation, such as a passkey prompt or a physical-device audio check.

Any change to scope, required coverage, persona access, fixture contract, or acceptance targets requires an explicit project-owner decision recorded in the relevant story before execution. A failure remains a failure against the agreed criterion; implementation choices within those boundaries are the agent's responsibility.
