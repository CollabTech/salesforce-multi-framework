# SMF-2 planning dry run (SMF-1 GOV-02 / AC8)

Bounded dry run: a fresh agent session, given only the assignment "SMF-2", follows the
repository's instructions and produces a test/evidence plan **without touching any org or
file**. This is the output that SMF-2 starts from; it is a plan, not a result.

This is the **second run** (after the standing execution rule was added to `AGENTS.md` §4).
The first run, against commit `cb21b8c`, is in this file's Git history; its §8 follow-ups
(this folder, `docs/private-mapping-format.md`, C-05, C-01 extension) were made then.

| Field | Value |
|---|---|
| Agent | Claude Code 2.1.288, headless (`claude -p`) |
| Isolation | Fresh `git clone` of commit `8ccdef8`; empty `HOME` (no user-level skills, settings or memory); `--setting-sources project` |
| Tools allowed | Read, Glob, Grep, Skill. Denied: Bash, Write, Edit, WebFetch, WebSearch, NotebookEdit — no org or file changes possible |
| Access | No Jira, no Salesforce org |
| Started / finished | 2026-10-03T20:53:23Z / 2026-10-03T20:54:30Z; `git status` in the clone afterwards: clean |
| Prompt | below, verbatim. Item (9) is new in this run and tests the standing execution rule |

> You are a fresh contributor agent in this repository. You have been assigned Jira story SMF-2. In this session you have NO Jira access and NO Salesforce org access, and you must not change any org or file: this is a bounded planning dry run only. Follow the repository's own instructions to prepare for SMF-2. Output, in Markdown: (1) which instruction files you read, in order; (2) where you found SMF-2's acceptance tests and the shared test contract, quoting the case IDs; (3) the project and official skills you selected, and confirm you opened each selected SKILL.md; (4) the explicit target-org requirement you must follow; (5) the personas and fixtures relevant to SMF-2; (6) a per-case test/evidence plan for every SMF-2 case ID using the repository's evidence template fields; (7) stop conditions; (8) anything ambiguous or missing in the repository instructions; (9) for any persona, grant or fixture the plan relies on: whether it already exists, which story owns provisioning it, and what you would do if you delegated that work.

Follow-ups made from this run's output (same PR):
- §8.5 (official `dx-*` skills auto-write raw org JSON with usernames/org IDs into
  `force-app/main/adk-eval-output/`): `.gitignore` now ignores `**/adk-eval-output/` and
  `smf-salesforce-boundaries` says to route such output to `private/`.
- §8.1 (is SMF-1 accepted?): answered by Jira status — SMF-1 is *Testing* until Brandon
  reviews the PR; SMF-2 stays blocked until then (the agent listed this as a stop condition).
- §8.8 (C-01): the agent still followed the story-specific scope, which is what the standing
  rule now says; C-01 updated.
- §8.2–8.4, 8.6, 8.7 are SMF-2 work (ENV-01/03) and stay with SMF-2. §8.10 is covered by GOV-01.

---

## Agent output (verbatim)

### SMF-2 planning dry run (no Jira, no org, no file changes)

This is a plan only. I ran no `sf` commands and wrote no files. I used the dated snapshot `docs/jira-snapshot/2026-10-03/` because I have no Jira access. Jira is authoritative, so the live text has to be re-checked before real work.

#### 1. Instruction files read, in order
1. `CLAUDE.md`, which only imports `AGENTS.md`.
2. `AGENTS.md`, all sections.
3. `testing/test-plan-index.json`.
4. `testing/contract.json`.
5. `docs/jira-snapshot/2026-10-03/SMF-2.md`, the assigned story.
6. `docs/jira-snapshot/2026-10-03/SMF-1.md`, SMF-2's only dependency.
7. `docs/jira-snapshot/2026-10-03/SMF-3.md`, the shared contract.
8. `evidence/TEMPLATE.md`.
9. `docs/contradictions.md`.
10. The selected `SKILL.md` files (see §3).
11. `docs/private-mapping-format.md`.
12. `docs/dry-runs/SMF-2-plan.md`. A prior dry-run output already exists in the repo, and I read it last. I treat it as a prior plan, not as evidence. I re-derived everything below from the sources above.

I did not open `testing/README.md`, `evidence/README.md`, the ADRs or `docs/provenance/*`.

#### 2. Where the acceptance tests and shared contract are
- **SMF-2's cases** are in `testing/test-plan-index.json` under SMF-2. They are repeated in the "Acceptance test checklist" of the SMF-2 snapshot.
  - **ENV-01:** "Authenticate and verify the actual org identity/edition before any writes; independently verify Dev Hub, unlocked 2GP, and the current Multi-Framework prerequisites."
  - **ENV-02:** "Record scratch-org/package capacity and licenses sufficient for the defined test personas; shortages produce explicit blockers."
  - **ENV-03:** "Document separate dev/install-test targets and the repeatable setup path. Report each readiness item as observed PASS/BLOCKED; do not claim a package has been tested."
- **The shared test contract** is the "Shared test contract" section of the SMF-3 snapshot. The machine-readable copy is `testing/contract.json`. It holds personas, fixtures, environment rows, outcome definitions, evidence fields, the Definition of Done and `fixture_provisioning_ownership`.

#### 3. Skills selected
I opened each of these at `.agents/skills/<name>/SKILL.md`. I did not check the `.claude/skills` symlinks, which is GOV-01's job.

**Project skills**
- `smf-story-workflow`
- `smf-evidence`
- `smf-salesforce-boundaries`
- `smf-public-provenance`. It applies because the repo is public and evidence and Jira comments will be published.

**Official skills**, the SMF-2 row of the `AGENTS.md` §3 table
- `dx-org-devhub-configure`
- `dx-org-manage`
- `dx-org-switch`
- `dx-org-analyze`
- `dx-org-trial-expiration-check`
- `platform-docs-get`

**Not selected**
- `smf-capability-probe`: SMF-2 is a readiness report, not a probe.
- `smf-physical-mobile-testing`: SMF-2 makes no device claim.
- `experience-ui-bundle-2gp-deploy`: it belongs to SMF-5, and SMF-2 must not claim packaging works.

No skill covers the UIBundle packaging API version. I will use `platform-docs-get` for that and say so.

#### 4. Target-org requirement
- Every `sf` command that touches an org passes `--target-org <alias>`. I never rely on an implicit default org (`AGENTS.md` §5; `smf-salesforce-boundaries`).
- Before any write, I run `sf org display --target-org <alias> --json` and record only sanitized edition, API version and status. I never use `--verbose`, because it leaks `sfdxAuthUrl`.
- The Dev Hub is not the application test org. The dev org and the install-test org are separate.
- Several skill defaults conflict with explicit targeting, so I override them:
  - `devhub.sh` falls back to `target-org` and then `target-dev-hub`. I always pass the alias.
  - `dx-org-manage` resolves the Dev Hub from `sf config get target-dev-hub`. I pass an explicit `--target-dev-hub` from the private mapping and never invent an alias.
  - `dx-org-switch` only sets a default, so it does not satisfy the rule.
- `sf org open` never gets `--json` or `--url-only`, because they leak live login URLs.

#### 5. Personas and fixtures relevant to SMF-2
- **Persona:** MF-ADMIN is the only persona SMF-2 names. It does setup only. Brandon performs any passkey or interactive login.
- **Not exercised:** MF-TECH, MF-SUPPORT and MF-RESTRICTED. ENV-02 only sizes licences and capacity for them. A shortage is BLOCKED, and the negative-test persona is never dropped.
- **Fixtures:** SMF-2 creates none. For sizing, the relevant ones are:
  - MF-ACCOUNT-001
  - MF-ASSET-001 and MF-ASSET-002
  - MF-CASE-001 and MF-CASE-002, where 002 needs an owner outside all personas
  - MF-IMAGE-001 and MF-FILE-DENIED
- **Environment rows:** none apply. I record the CLI host OS and `sf` version only and write "n/a – org/CLI readiness". I make no mobile statement.
- **Private mapping:** SMF-2 writes `private/orgs.json` with `dev-hub`, `dev` and `install-test` entries (format in `docs/private-mapping-format.md`). Nothing from it goes into public files.

#### 6. Per-case test and evidence plan
Records go in `evidence/SMF-2/<CASE-ID>.md`, copied from `evidence/TEMPLATE.md`. Outcome stays NOT TESTED until a run is executed. Common template fields:
- **Story:** SMF-2.
- **Fixture IDs / hash / version:** none (n/a).
- **Build / commit:** repo git SHA at run time. No package version.
- **Host / device / OS / app / browser:** CLI host OS, `sf` and `jq` versions, and the pinned skills revision.
- **Environment row:** n/a.
- **Timestamp:** ISO-8601 with timezone.

##### ENV-01 — identity and edition first, then Dev Hub, 2GP and Multi-Framework prerequisites
- **Persona pair:** MF-ADMIN, plus Brandon for interactive auth.
- **Preconditions:**
  - SMF-1 is accepted, or a fallback is recorded.
  - The org alias is in the local credential store.
- **Steps:**
  1. `sf org list` to find the alias. Its output is not pasted anywhere.
  2. `sf org display --target-org <alias> --json`, keeping sanitized edition, API version and status only.
  3. `dx-org-trial-expiration-check` on the explicit org, to confirm it is not expired.
  4. `devhub.sh <alias>` in status mode, with no `--enable`. A successful `ScratchOrgInfo` query means Dev Hub is on.
  5. Verify unlocked 2GP packaging (`enablePackaging2`), Hyperforce, the Salesforce app domain, Edge requirements, and the API version needed for UIBundle packaging.
  6. Look up the current Multi-Framework prerequisites with `platform-docs-get`, citing title, URL and caveats.
  7. Label each item "observed" or "assumed".
- **Expected result:** the ENV-01 text quoted in §2.
- **Actual result:** sanitized observed values.
- **Outcome:** PASS or BLOCKED per prerequisite. An assumption is never PASS.
- **Evidence link:** a sanitized text log in `evidence/SMF-2/`.
- **Tester:** agent, with Brandon for login.
- **Limitation:** packaging is not claimed until SMF-5.

##### ENV-02 — capacity and licences
- **Persona pair:** MF-ADMIN, assessing capacity for TECH, SUPPORT and RESTRICTED.
- **Steps:**
  1. Read user and permission-set licence totals and used counts with `sf data query`, or with `dx-org-analyze` in single-org read-only mode.
  2. Read scratch-org capacity with `devhub.sh <alias> --allocation`, or `sf org list limits --target-org <alias>`.
  3. Check that the admin holds the "Create and Update Second-Generation Packages" permission.
  4. Compare against need: three non-admin users plus the admin, one owner for MF-CASE-002 outside all personas, and one install-test org.
  5. State explicitly where no data is available.
- **Expected result:** the ENV-02 text quoted in §2.
- **Outcome:** PASS if sufficient. Otherwise BLOCKED, naming the shortage and the smallest unblocking action.
- **Tester:** agent.
- **Limitation:** counts are point-in-time.

##### ENV-03 — separate dev and install-test targets and the repeatable setup path
- **Persona pair:** MF-ADMIN.
- **Steps:**
  1. Name the Dev Hub, dev org and install-test org as three distinct targets, by logical alias only.
  2. Mark each as create or reuse. A new scratch org would use `dx-org-manage` with an explicit `--target-dev-hub`.
  3. Write the ordered setup commands, each with `--target-org`.
  4. Give each readiness item its own observed PASS or BLOCKED.
  5. State plainly that no package has been tested.
- **Expected result:** the ENV-03 text quoted in §2.
- **Outcome:** PASS if the separation and setup path are documented. BLOCKED, with the reason, if a target cannot be obtained.
- **Evidence link:** the readiness report plus a sanitized setup doc.
- **Tester:** agent, with Brandon only for interactive auth.
- **Limitation:** no packaging claim until SMF-5.

#### 7. Stop conditions
For each, I record the case ID, the exact gap and the smallest unblocking action. I flag Jira with a comment and stop that case without improvising. The triggers are:
- SMF-1 is not accepted, with no recorded fallback or scope decision. The snapshot shows it "In Progress", and the story says it must be accepted before Salesforce setup begins.
- Org identity or edition is not verified before a write, the alias is ambiguous, or the only resolvable org is the Dev Hub.
- A licence, tool or access is missing: no authenticated Dev Hub, `sf` or `jq` unavailable, or a login waiting on Brandon.
- Two instructions conflict. I log it in `docs/contradictions.md`.
- A step would change a threshold, scope, persona or fixture. That needs a project-owner decision recorded first.
- An irreversible or mutating action is proposed, such as `devhub.sh --enable --apply`, scratch-org creation or deletion, or `sf org open`. It needs explicit approval, and a dry run comes first.
- Anything private would be published: tokens, `sfdxAuthUrl`, org IDs or real usernames. I stop and tell Brandon, and rotate the credential before any history rewrite.

#### 8. Ambiguous or missing in the instructions
1. **Is SMF-1 accepted?** The snapshot says "In Progress", but SMF-2 depends on it. The repo does not say whether GOV-02 counts as acceptance.
2. **"Edge requirements" (AC3)** could mean the Edge browser or the Salesforce edge network. This is C-05, still open.
3. **The UIBundle packaging API version** is not stated anywhere. The skills cite 47.0, 60.0 and 62.0 for other operations.
4. **No named check exists** for Hyperforce or the Salesforce app domain.
5. **Skill artifact output can leak private data.** `dx-org-manage` writes the raw org-list entry (username, orgId) to `force-app/main/adk-eval-output/` if that directory exists. `dx-org-analyze` writes reports to `/tmp` and optionally there. Neither is safe in a public repo. I would keep output out of the repo and sanitize before copying anything into `evidence/`.
6. **Who supplies the "private org-identity mapping"** that SMF-2's test data lists as a prerequisite is not stated. `docs/private-mapping-format.md` says SMF-2 writes `private/orgs.json`, so it is a deliverable rather than an input.
7. **A Developer org may not provide a second org** without Dev Hub scratch capacity. That needs an explicit decision.
8. **The shared "provision or reconcile users" paragraph** repeats in SMF-2 but conflicts with SMF-2's own scope. This is C-01. I follow the story-specific scope.
9. **The outcome definitions are a draft** (C-04), and SMF-2 uses that wording.
10. **I did not check** the skill symlinks, the `skills-lock.json` pin or the §7 scripts, because I ran nothing.

#### 9. Existence, ownership and delegation of what the plan relies on
**Existence.** I could not verify that any of these exist. The repo has no `private/`, no `evidence/SMF-2/`, no `sfdx-project.json` and no `force-app/`. `testing/contract.json` says "No fixtures are claimed to exist yet". So I treat everything below as not verified to exist.

| Item | Exists? | Owner of provisioning | If I delegated |
|---|---|---|---|
| Authenticated Dev Hub / org alias, `private/orgs.json` | Unverified | SMF-2 (me), with Brandon for auth | I would not delegate. I verify it myself (ENV-01). |
| Dev org and install-test org | Unverified | SMF-2 documents them. Creation is allowed only after approval. | The delegate gets ENV-03, the org alias to create or reuse, and an explicit `--target-dev-hub`. It returns a sanitized `sf org display` summary and expiry. I re-verify identity and edition myself. |
| MF-ADMIN | Unverified | The setup admin, per SMF-3 | None. I only use the admin session. |
| MF-TECH, MF-SUPPORT, MF-RESTRICTED | Unverified | SMF-3, DATA-01..04 | SMF-2 only sizes licences (ENV-02). If asked, the delegate gets SMF-3 DATA-02 and DATA-03, the three personas, the expected denials, and the return of sanitized evidence. I verify it and record any gap as BLOCKED. |
| MF-ACCOUNT-001, MF-ASSET-001/002, MF-CASE-001/002, MF-IMAGE-001, MF-FILE-DENIED | Unverified | SMF-3 | Same pattern as the row above. |
| MF-ROOM-001/002 | Specification only | SMF-7 (provider rooms and tokens) | Not delegated here. SMF-2 never needs it. |
| MF-MARKUP-001 | Specification only | SMF-11/12 | Not delegated here. |
| MF-MODEL-SMALL / MF-MODEL-REP | Specification only | SMF-13/14 | Not delegated here. |
| Licence and capacity data | Unverified | SMF-2 (ENV-02) | Read-only reads could go to a delegate named for ENV-02. I check the numbers against my own re-query. |

Any delegation prompt would name:
- the story and case IDs
- the personas and fixtures
- the expected outcome
- the evidence to return, sanitized and with no IDs, usernames or tokens

I would re-verify what comes back and take no returned PASS on trust.
