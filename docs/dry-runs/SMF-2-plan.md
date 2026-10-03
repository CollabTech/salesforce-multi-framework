# SMF-2 planning dry run (SMF-1 GOV-02 / AC8)

Bounded dry run: a fresh agent session, given only the assignment "SMF-2", follows the
repository's instructions and produces a test/evidence plan **without touching any org or
file**. This is the output that SMF-2 starts from; it is a plan, not a result.

| Field | Value |
|---|---|
| Agent | Claude Code 2.1.288, headless (`claude -p`) |
| Isolation | Fresh `git clone` of commit `cb21b8c`; empty `HOME` (no user-level skills, settings or memory); `--setting-sources project` |
| Tools allowed | Read, Glob, Grep, Skill. Denied: Bash, Write, Edit, WebFetch, WebSearch, NotebookEdit — no org or file changes possible |
| Access | No Jira, no Salesforce org |
| Started | 2026-10-03T18:42:48Z |
| Prompt | below, verbatim |

> You are a fresh contributor agent in this repository. You have been assigned Jira story SMF-2. In this session you have NO Jira access and NO Salesforce org access, and you must not change any org or file: this is a bounded planning dry run only. Follow the repository's own instructions to prepare for SMF-2. Output, in Markdown: (1) which instruction files you read, in order; (2) where you found SMF-2's acceptance tests and the shared test contract, quoting the case IDs; (3) the project and official skills you selected, and confirm you opened each selected SKILL.md; (4) the explicit target-org requirement you must follow; (5) the personas and fixtures relevant to SMF-2; (6) a per-case test/evidence plan for every SMF-2 case ID using the repository's evidence template fields; (7) stop conditions; (8) anything ambiguous or missing in the repository instructions.

Repository follow-ups made from §8 of the output (same PR): created `docs/dry-runs/`
(this file), documented the `private/` mapping format (`docs/private-mapping-format.md`),
logged C-05 and extended C-01 in `docs/contradictions.md`. Items 1, 5–8 belong to SMF-2.
Item 10 (symlinks not checked by the read-only agent) is covered by GOV-01.

---

## Agent output (verbatim)

### SMF-2 planning dry run (no org, no Jira, no file changes)

I used the dated snapshot `docs/jira-snapshot/2026-10-03/` for SMF-1, SMF-2 and SMF-3, because this session has no Jira access. Jira is authoritative, so the live text must be re-checked before real work.

#### 1. Instruction files read, in order

1. `CLAUDE.md`, which only imports `AGENTS.md`.
2. `AGENTS.md`. I used §2 for where work is defined, §3 for skill selection, §4 for the lifecycle, §5 for the non-negotiable rules and §7 for pre-PR checks.
3. `docs/jira-snapshot/2026-10-03/SMF-2.md`, the assigned story.
4. `docs/jira-snapshot/2026-10-03/SMF-3.md`, the shared contract.
5. `testing/test-plan-index.json`.
6. `testing/contract.json`.
7. `evidence/TEMPLATE.md`.
8. `docs/contradictions.md`.
9. `docs/jira-snapshot/2026-10-03/SMF-1.md`, SMF-2's only dependency.
10. Skills, each opened at `.agents/skills/<name>/SKILL.md`:
    - `smf-story-workflow`, `smf-evidence`, `smf-salesforce-boundaries`, `smf-public-provenance`.
    - `dx-org-devhub-configure`, `dx-org-manage`, `dx-org-switch`, `dx-org-analyze`, `dx-org-trial-expiration-check`, `platform-docs-get`.
11. `docs/poc-briefs/README.md` and `docs/adr/0002-salesforce-project-layout.md`.

I did not read these, and none were needed for the plan:
- `testing/README.md`
- `evidence/README.md`
- `docs/provenance/*`
- `docs/adr/0001-*`
- `skills-lock.json`
- the scripts

#### 2. Where the acceptance tests and shared contract live

- **SMF-2's cases** are in `testing/test-plan-index.json` under SMF-2 (backlog 2 of 16, POC-02, depends on SMF-1). They are the same as the "Acceptance test checklist" in the SMF-2 snapshot.
  - **ENV-01:** "Authenticate and verify the actual org identity/edition before any writes; independently verify Dev Hub, unlocked 2GP, and the current Multi-Framework prerequisites."
  - **ENV-02:** "Record scratch-org/package capacity and licenses sufficient for the defined test personas; shortages produce explicit blockers."
  - **ENV-03:** "Document separate dev/install-test targets and the repeatable setup path. Report each readiness item as observed PASS/BLOCKED; do not claim a package has been tested."
- **The shared test contract** is SMF-3's "Shared test contract" section in `docs/jira-snapshot/2026-10-03/SMF-3.md`. The machine-readable copy is `testing/contract.json`.
- **Acceptance criteria AC1–AC5** are in the SMF-2 snapshot. The cases above are the pass criteria; the ACs give the detail.
- **Index totals:** the index lists 16 stories and 54 case IDs, and I did not recount them.

#### 3. Skills selected

Each one below was opened and read.

**Project skills**
- `smf-story-workflow` (any story).
- `smf-evidence` (any story).
- `smf-salesforce-boundaries` (the SMF-2 row in `AGENTS.md` §3).
- `smf-public-provenance` (required for the PR, evidence and any Jira comment).

**Official skills (the SMF-2 row of the §3 table)**
- `dx-org-devhub-configure`
- `dx-org-manage`
- `dx-org-switch`
- `dx-org-analyze`
- `dx-org-trial-expiration-check`
- `platform-docs-get`

**Deliberately not selected**
- `smf-capability-probe`, because SMF-2 is a readiness report and not a capability probe.
- `smf-physical-mobile-testing`, because no device or mobile claim is made.
- `experience-ui-bundle-2gp-deploy`, which belongs to SMF-5. SMF-2 must not claim packaging works.
- No skill covers "UIBundle packaging API version". I will use `platform-docs-get` for that and say so, rather than guess a skill name.

**Verification caveat:** I did not check that the `.claude/skills/*` symlinks resolve. Glob returned nothing for them, which may only mean it does not follow symlinks.

#### 4. Target-org requirement

- Every `sf` command that touches an org passes `--target-org <alias>`. Never rely on an implicit default org (`AGENTS.md` §5; `smf-salesforce-boundaries`).
- Verify org identity before any write: `sf org display --target-org <alias>`. Never add `--verbose`, because it returns `sfdxAuthUrl`.
- The Dev Hub is not the application test org. The dev org and the install-test org are separate.
- `dx-org-manage` needs an explicit `--target-dev-hub` and stops if none resolves; it must never invent an alias.
- `dx-org-devhub-configure` runs a dry run by default, and `--enable --apply` is irreversible. It is not needed for ENV-01 unless Dev Hub is found off, and then only on explicit approval.
- If `dx-org-switch` is ever used, it only sets a default. It does not satisfy the explicit-target rule.
- Do not run `sf org open --json` or `--url-only`, because they leak login URLs.

#### 5. Personas and fixtures relevant to SMF-2

**Personas**
- **MF-ADMIN** is the only persona SMF-2 names. It does setup and provisioning only. Brandon is the human for passkey or interactive authorization.
- **MF-TECH, MF-SUPPORT and MF-RESTRICTED** are not exercised by SMF-2.
  - ENV-02 only checks that licences and capacity are enough for them.
  - Shortages are recorded as BLOCKED. The negative-test persona is never dropped.
- **Persona IDs are logical, not usernames.** The real mapping goes in `private/`, or in a credential store.

**Fixtures**
- No fixtures are provisioned by SMF-2. SMF-3 owns them.
- ENV-02 only sizes capacity for the roles and fixtures SMF-3 will need: MF-ACCOUNT-001, MF-ASSET-001/002, MF-CASE-001/002, and the Files (MF-IMAGE-001, MF-FILE-DENIED).
- SMF-2 must not claim they exist.

**Environment rows** (from `contract.json`)
- ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS and ENV-SFMOBILE-ANDROID are the required rows. SMF-2 has no device claims and makes no mobile statements.
- Set the environment-row field to "n/a – org/CLI readiness". Record the CLI host's OS and `sf` version only.

#### 6. Per-case test and evidence plan

Template fields are as in `evidence/TEMPLATE.md`. Outcome is NOT TESTED until executed. The records go at `evidence/SMF-2/<CASE-ID>.md`.

### ENV-01 — org identity and edition, then Dev Hub, 2GP and Multi-Framework prerequisites
- **Case ID / Story:** ENV-01 / SMF-2
- **Persona pair:** MF-ADMIN alone, plus Brandon for any interactive login.
- **Fixture IDs / hash / version:** none (n/a).
- **Build / commit:** repo git SHA at run time. No package version.
- **Host / device / OS / app / browser:** CLI host OS, `sf` and `jq` versions, Node and Python if used, and the skills' pinned revision. Runtime origin is "n/a (CLI)".
- **Timestamp:** ISO-8601 with timezone, recorded at run time.
- **Preconditions:**
  - SMF-1 is accepted, or a recorded fallback exists.
  - The org alias is in the local credential store.
  - Brandon completes any browser or passkey login.
- **Steps:**
  1. `sf org list` to find the alias. Do not paste the output into evidence.
  2. `sf org display --target-org <alias> --json`. Keep only sanitized edition, API version and status.
  3. Run `dx-org-trial-expiration-check` for the org, to check it is not expired.
  4. Run `dx-org-devhub-configure`'s `devhub.sh` in status mode only (no `--enable`).
  5. Check unlocked/2GP packaging is on, Hyperforce, the Salesforce app domain, Edge requirements, and the API version needed for UIBundle packaging.
  6. Look up "current Multi-Framework prerequisites" via `platform-docs-get`, citing title, URL and caveats.
  7. Label each item "observed" or "assumed".
- **Expected result:** quote the ENV-01 spec.
- **Actual result:** observed values, sanitized.
- **Outcome:** PASS or BLOCKED per prerequisite (as ENV-03 requires). Do not mark an assumption as PASS.
- **Evidence link:** a sanitized text log under `evidence/SMF-2/`.
- **Tester:** the agent, with Brandon for interactive auth.
- **Limitation / follow-up:** the packaging claim waits for SMF-5.

### ENV-02 — capacity and licences
- **Case ID / Story:** ENV-02 / SMF-2
- **Persona pair:** MF-ADMIN, assessing capacity for MF-TECH, MF-SUPPORT and MF-RESTRICTED.
- **Fixture IDs:** the fixtures listed in section 5. Capacity is sized only, nothing is created.
- **Steps:**
  1. Read licence quantities and used counts. `dx-org-analyze` single-org mode is read-only and provides licences, limits and installed packages; `sf data query` is the fallback.
  2. Read scratch-org and package limits with `devhub.sh --allocation`.
  3. Read package-creation permission from the Dev Hub.
  4. Compare against need: three non-admin users plus the admin, an owner for MF-CASE-002 outside all personas, and an install-test org.
  5. Say where no licence data is available.
- **Expected result:** "sufficient for the defined test personas; shortages produce explicit blockers" (quoted).
- **Outcome:** PASS if sufficient. BLOCKED, with the named shortage and unblocking action, if not. The negative-test persona is never dropped.
- **Tester:** the agent.
- **Limitation:** the capacity numbers may change over time.

### ENV-03 — separate dev and install-test targets and the repeatable setup path
- **Case ID / Story:** ENV-03 / SMF-2
- **Persona pair:** MF-ADMIN.
- **Steps:**
  1. Name the Dev Hub, dev org and install-test org as three separate targets, by alias only.
  2. Document each as create or reuse. If a scratch org is needed, use `dx-org-manage` with an explicit `--target-dev-hub`. This is a plan only.
  3. Write down the setup commands, each with `--target-org`.
  4. Give each readiness item its own observed PASS or BLOCKED.
  5. State plainly that no package has been tested.
- **Expected result:** quote the ENV-03 spec.
- **Outcome:** PASS if the documentation and the separation are complete. BLOCKED, with the reason, if an org cannot be obtained.
- **Evidence link:** the readiness report plus the sanitized setup document.
- **Tester:** the agent, with Brandon only if auth is interactive.
- **Limitation:** no packaging claim until SMF-5.

#### 7. Stop conditions

Record the case ID, the exact gap and the smallest unblocking action. Flag the Jira issue with a comment (blocked), and stop that case without improvising. Triggers:

- SMF-1 is not accepted. The snapshot shows it "In Progress"; SMF-1 says it "must be accepted before Salesforce setup begins". Do not start env work until it is accepted or there is a recorded fallback or scope decision.
- Org identity or edition is not verified before a write, or the alias is ambiguous.
- No `--target-org` alias is available, or the only resolvable org is the Dev Hub.
- Licence, tool or access is missing, e.g. no authenticated Dev Hub, `sf` or `jq` unavailable, or a login needing a passkey Brandon has not done.
- Two instructions conflict. Record it in `docs/contradictions.md`.
- A step would require changing a threshold, scope, persona or fixture. That needs a recorded project-owner decision.
- Any destructive or irreversible action, such as `devhub.sh --enable --apply`. That needs explicit approval, and the dry run comes first.
- Anything private would be published (tokens, `sfdxAuthUrl`, org IDs, real usernames). Stop and tell Brandon; credential rotation comes before rewriting history.

#### 8. Ambiguous or missing in the repository instructions

1. **SMF-1 is not accepted.** The snapshot shows SMF-1 "In Progress", while SMF-2 depends on it. The repo does not say whether this dry run (GOV-02) counts as that acceptance. The unblocking action is Brandon's confirmation.
2. **`docs/dry-runs/` does not exist,** though `AGENTS.md` §6 lists it and gives SMF-2 as an example.
3. **`private/` does not exist,** and no format is given for the private persona↔username mapping. Say where it goes and how.
4. **No evidence folder or records exist for SMF-2,** and the contradictions note C-04 says the outcome definitions are a draft. I used the draft wording.
5. **The UIBundle packaging API version is not stated anywhere I read.** The skills carry different minimum versions (47.0, 60.0, 62.0) for other things. The needed version has to be looked up through `platform-docs-get` or the packaging skill.
6. **"Edge requirements" in SMF-2 AC3 is undefined.** It could mean the Edge browser or the Salesforce edge network. The repo does not say.
7. **"Hyperforce" and "Salesforce app domain" have no named CLI check.** The mechanism will need to be chosen at execution time.
8. **Who or what supplies the "private org-identity mapping"** is unclear, since SMF-2's test data lists it as a prerequisite. It is also unclear whether a Developer org supports separate dev and install-test orgs without a Dev Hub allocation.
9. **The shared Jira "provision or reconcile users" contract conflicts with SMF-2's own scope.** That text is also in SMF-2, but SMF-3 owns provisioning. C-01 notes the same conflict for SMF-1. I followed the story-specific text: no provisioning in SMF-2.
10. **I did not verify** the skills-lock pin, the `.claude/skills` symlinks, or the §7 check scripts, since I ran nothing.
