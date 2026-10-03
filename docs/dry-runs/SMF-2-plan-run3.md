# SMF-2 planning dry run — run 3 (SMF-1 GOV-02 after the review corrections)

Fresh clone of `b79111a` with the official skills installed by `scripts/bootstrap-skills.py`; empty `HOME`; `--setting-sources project`; tools Read/Glob/Grep/Skill only (Bash/Write/Edit/Web denied); no Jira, no org. Started 2026-10-03T21:42:56Z, finished 21:44:24Z; `git status` in the clone afterwards: clean. Prompt = run 2's prompt with item (3) asking to open each skill via `.claude/skills/<name>/SKILL.md` and a new item (10) asking what must be run after cloning. Runs 1 and 2: `SMF-2-plan.md` and its Git history.

---

## Agent output (verbatim)

I read the instruction files, case index, contract, evidence template and the selected skills. Nothing was changed, and I did not run any command, because Bash is disabled here. Below is the SMF-2 dry-run plan.

### 1. Instruction files read, in order
1. `CLAUDE.md`, which defers to `AGENTS.md` (both were already loaded into my context).
2. `AGENTS.md`, all sections.
3. `testing/test-plan-index.json` and `testing/README.md`.
4. `testing/contract.json` (the SMF-3 shared contract).
5. `evidence/TEMPLATE.md` and `evidence/README.md`.
6. `docs/jira-snapshot/2026-10-03/SMF-2.md`, then its dependency `SMF-1.md`, then `SMF-3.md`.
   - I used the dated snapshot because I have no Jira access. Jira itself is authoritative, so this is the fallback.
7. `docs/contradictions.md`, `docs/private-mapping-format.md`, `README.md`.
8. The selected skills (section 3).

I deliberately did not open `docs/dry-runs/SMF-2-plan.md`. It is an existing answer, and reading it would contaminate this fresh-contributor test.

### 2. Where SMF-2's tests and the shared contract are
- **SMF-2 cases:** `testing/test-plan-index.json` lists SMF-2 with cases **ENV-01, ENV-02, ENV-03**. The same IDs are in `testing/README.md` and `docs/jira-snapshot/2026-10-03/SMF-2.md`.
- **Dependencies:** SMF-1 only. The index shows persona refs `["MF-ADMIN"]` and fixture refs `[]`.
- **Shared contract:** `testing/contract.json`, captured from SMF-3 (snapshot `SMF-3.md`). It covers personas, fixtures, environments, outcomes, evidence fields and the Definition of Done.
- **Case text:**
  - **ENV-01:** "Authenticate and verify the actual org identity/edition before any writes; independently verify Dev Hub, unlocked 2GP, and the current Multi-Framework prerequisites."
  - **ENV-02:** "Record scratch-org/package capacity and licenses sufficient for the defined test personas; shortages produce explicit blockers."
  - **ENV-03:** "Document separate dev/install-test targets and the repeatable setup path. Report each readiness item as observed PASS/BLOCKED; do not claim a package has been tested."

### 3. Skills selected
I selected these from the `AGENTS.md` §3 table for "Any story" and "Org identity, Dev Hub, scratch/test orgs (SMF-2)". I opened each through `.claude/skills/<name>/SKILL.md`, and all opened successfully.

| Kind | Skill | Opened via `.claude/skills/…/SKILL.md` |
|---|---|---|
| Project | `smf-story-workflow` | Yes |
| Project | `smf-evidence` | Yes |
| Project | `smf-salesforce-boundaries` | Yes |
| Official | `dx-org-devhub-configure` | Yes |
| Official | `dx-org-manage` | Yes |
| Official | `dx-org-switch` | Yes |
| Official | `dx-org-analyze` | Yes |
| Official | `dx-org-trial-expiration-check` | Yes |
| Official | `platform-docs-get` | Yes |

- **Not selected:**
  - `smf-physical-mobile-testing`: SMF-2 makes no device or mobile claim.
  - `smf-capability-probe`: SMF-2 builds no probe.
  - `experience-ui-bundle-2gp-deploy`: this is SMF-5's work, and ENV-03 forbids claiming a package works.
  - `smf-public-provenance`: I opened it, and I will apply it before any commit or PR.
- **What I would use each official skill for:**
  - `dx-org-devhub-configure`: Dev Hub status and scratch allocation, read-only (no `--enable`, no `--apply`).
  - `dx-org-trial-expiration-check`: Developer org expiry.
  - `dx-org-analyze`: single-org inventory covering licenses, limits and installed packages.
  - `dx-org-manage`: `sf org display`, and scratch-org creation only if a later decision requires it.
  - `dx-org-switch`: only to list or inspect orgs.
  - `platform-docs-get`: current Multi-Framework requirements, "Edge requirements" and the packaging API version.

### 4. Target-org requirement
- Every `sf` command that touches an org passes `--target-org <alias>` (or the skill's equivalent). I never rely on an implicit default org (`AGENTS.md` §5, `smf-salesforce-boundaries`).
- Verify identity first, with `sf org display --target-org <alias>` and no `--verbose`, before any write. Record sanitized results only.
- The Dev Hub is not the application test org. The dev org and the install-test org are separate (ENV-03).
- The Dev Hub skill's script falls back to the default org when no alias is given. I would always pass the alias explicitly, and the skill itself refuses to apply changes without one.
- I would not use `sf org open --json` or `--url-only`, because they leak login tokens.
- I would point any raw skill JSON output at `private/`.

### 5. Personas and fixtures relevant to SMF-2
- **Persona:** `MF-ADMIN` only. Per `contract.json` it is for provisioning and package install only, and its success never proves business-user access.
- **Human actor:** Brandon, for the passkey or other interactive authorization.
- **Fixtures:** none. SMF-2's fixture refs are `[]`.
- **Context SMF-2 needs from the contract:** ENV-02 must size capacity and licenses for all four personas (MF-ADMIN, MF-TECH, MF-SUPPORT, MF-RESTRICTED). It must not provision them.
- **Prerequisites** (`test_data` in the index): an existing Developer org, the completed repo and board baseline, and a private org-identity mapping.

### 6. Per-case test and evidence plan
Evidence goes in `evidence/SMF-2/<CASE-ID>.md`, from `evidence/TEMPLATE.md`. Every case below is NOT TESTED in this dry run. The persona pair is MF-ADMIN plus Brandon, using logical IDs only. Fixture IDs are none. Build or commit is the git SHA, with no package version. For each case I would fill these template fields:

| Template field | Value for all three cases |
|---|---|
| Story | SMF-2 |
| Host / device | `sf` and Node versions, plus the OS. There is no browser or device. |
| Environment row | None of the `ENV-*` rows in `contract.json` fit. I would write "n/a (CLI/Setup readiness, no host)" and flag it (section 8). |
| Timestamp | ISO-8601 with timezone |
| Outcome | PASS or BLOCKED per readiness item, or NOT TESTED if not run |
| Evidence link | A sanitized log, screenshot or text under `evidence/SMF-2/`, with raw JSON kept in `private/` |
| Tester | Who did each step: agent, or Brandon for interactive steps |

What differs per case:

- **ENV-01**
  - **Preconditions:** `sf` ≥ 2, Node ≥ 18, and an authenticated alias from `private/orgs.json`. If there is no alias, Brandon completes `sf org login web --alias <alias>`.
  - **Steps:**
    1. `sf org display --target-org <alias>`. Confirm identity, edition and instance type, with no write.
    2. Run `dx-org-devhub-configure` in read-only status mode for Dev Hub enabled or not. The skill's own signal is that `ScratchOrgInfo` is queryable.
    3. Check that packaging is enabled (`enablePackaging2` / unlocked 2GP) and that the user holds the "Create and Update Second-Generation Packages" permission.
    4. With `platform-docs-get`, look up Multi-Framework requirements, Hyperforce, the Salesforce app domain, "Edge requirements" and the UIBundle packaging API version. Compare these with the org's API version.
    5. Label each item "observed" or "assumed".
  - **Expected:** quoted from the ENV-01 text above.
  - **Actual:** each readiness item recorded as observed PASS/BLOCKED.
- **ENV-02**
  - **Preconditions:** ENV-01 passed and Dev Hub is on.
  - **Steps:**
    1. Run `sf org list limits` (as the devhub skill's `--allocation` does) for the Active and Daily scratch allocation.
    2. Run `dx-org-analyze` single-org mode, or the equivalent `sf data query`, for user and permission-set licenses and package licenses.
    3. Compare against four personas: MF-ADMIN, MF-TECH, MF-SUPPORT and MF-RESTRICTED.
    4. Run `dx-org-trial-expiration-check` on the dev org.
  - **Expected:** quoted from the ENV-02 text above.
  - **Actual:** numbers recorded, plus a BLOCKED entry per shortage that names the missing licence and the unblocking action.
  - **Note:** I would not drop MF-RESTRICTED even if licences are short. The contract says to mark the affected cases BLOCKED.
- **ENV-03**
  - **Preconditions:** ENV-01 and ENV-02 findings.
  - **Steps:**
    1. Choose a dev org and a separate install-test org. Both are separate from the Dev Hub.
    2. Document the creation or reuse steps, and the blockers.
    3. Write a repeatable setup path: the alias convention, the `private/orgs.json` shape, and the commands, each with `--target-org`.
  - **Expected:** quoted from the ENV-03 text above.
  - **Actual:** a PASS/BLOCKED list.
  - **Note:** the report must not claim packaging works. That is SMF-5.
- **Story handoff:** an environment readiness report with PASS/BLOCKED per prerequisite, a draft PR with a case-ID results table, the selected skills, limitations, and completed versus outstanding work. Before the PR I run the §7 checks and `smf-public-provenance`. I move Jira to In Progress at the start and to Testing when evidence is pending.

### 7. Stop conditions
Record the case ID, the exact gap and the smallest unblocking action, flag the Jira issue, and stop that case if any of these occurs:
- **Org:** the org identity or edition is not verified, or there is no `--target-org` alias.
- **Access:** a licence, device or tool is missing, or a passkey or interactive login is needed. In that case I ask Brandon for that specific interaction.
- **Instructions and thresholds:** two instructions conflict, or a threshold would need changing.
- **Writes needing a decision:** an irreversible or mutating action (`--enable --apply`, scratch-org creation, any deploy) is not clearly requested or authorized.
- **Leaks:** a secret or private identifier would reach Git, a PR or a Jira comment. In that case I stop and tell Brandon.
- **Scope:** the work would drift into SMF-3 (provisioning users or fixtures) or SMF-5 (packaging).

### 8. Ambiguities and gaps in the repository instructions
- **"Edge requirements" and the UIBundle packaging API version.** The stories do not define either. It could mean the Edge browser or a Salesforce Edge network. This is open as C-05 in `docs/contradictions.md`.
- **MF-ADMIN has no defined account.** SMF-2 uses it, but SMF-3 owns provisioning the personas. I assume it means the existing Developer-org admin login, and the repo does not say so.
- **No alias exists yet.** `private/orgs.json` (written by SMF-2) is not in the repo.
- **No environment row fits.** `contract.json` has no row for CLI or Setup readiness, so the template's "Environment row" field has no valid value.
- **ENV-01 versus the irreversible Dev Hub enable.**
  - "Verify before any writes" sits against the devhub skill's irreversible `--enable --apply`.
  - It is unclear whether SMF-2 may enable Dev Hub, packaging or snapshots if they are off, or must report BLOCKED and ask Brandon.
- **Install-test org creation.** ENV-03 says to document creation or reuse steps. It does not say whether SMF-2 may create the org, or only plan it.
- **`dx-org-switch` versus explicit targeting.** `dx-org-switch` sets a default org, which sits awkwardly with "never rely on a default org".
- **Raw output from official skills.** Some write raw JSON that contains usernames and org IDs to `adk-eval-output` or `/tmp`. They need redirecting, but the skills cannot be edited.
- **Contract draft pending review.** The outcome wording in `contract.json` is marked "proposed draft pending SMF-3 review" (C-04).
- **Shared "provision users" paragraph.** It appears in every story, including SMF-2 (C-01). This is now reconciled by the `AGENTS.md` §4 standing rule.
- **Tooling oddity.** `.claude/skills` is git-ignored and Glob did not list it, yet Read opened the files, so the links exist in this checkout.

### 9. Personas, grants and fixtures the plan relies on
Nothing has verified evidence of existence. The contract says the personas and fixtures are specifications, not proof.

| Item | Exists? | Owner story | If I delegated it |
|---|---|---|---|
| Dev org and MF-ADMIN access | Unverified. The brief says an "existing Developer org". | Org prerequisite, verified in SMF-2 ENV-01 | I verify it myself. It needs Brandon's interactive login. |
| `private/orgs.json` | Not present | SMF-2 | I write it myself (git-ignored). |
| Dev Hub and unlocked 2GP settings | Unverified | SMF-2 (observe) | Read-only, run by me. |
| Install-test org | Unknown | SMF-2 documents it. Any package install is SMF-5. | Delegate only the creation or reuse step. I would name ENV-03, MF-ADMIN, expected PASS/BLOCKED, and return a sanitized `sf org display`. |
| MF-TECH, MF-SUPPORT, MF-RESTRICTED | Not provisioned | SMF-3 | SMF-2 only counts licences (ENV-02). If I ever delegated provisioning, I would name SMF-3 DATA-02 and DATA-03, the persona definitions, the denial expectations and the evidence to return. |
| Fixtures `MF-CASE-*`, `MF-IMAGE-*`, `MF-ROOM-*`, `MF-MARKUP-*`, `MF-MODEL-*` | None exist, and SMF-2 needs none | SMF-3, with SMF-7 (rooms and tokens), SMF-11/12 (markup) and SMF-13/14 (3D) | Not delegated. |

For any delegated task, I would name the exact story and case IDs, personas, fixtures, expected outcome and the evidence to return. I would then verify that evidence myself before relying on it.

### 10. What to run after cloning, before skills are available
Run once per clone:

```sh
python3 scripts/bootstrap-skills.py     # Windows: py -3 scripts\bootstrap-skills.py
```

- It installs the 28 pinned official skills at project scope (not tracked in Git). It also creates the `.claude/skills` entries (symlink, Windows junction or copy) and verifies every file against upstream.
- It needs Python 3.8+, Node 18+ (`npx`), and network access to github.com and registry.npmjs.org.
- If `python3 scripts/verify-skills.py` fails, rerun the bootstrap. Never edit vendor files or install skills globally (`-g`).
- Before any PR, `AGENTS.md` §7 also requires `check-test-plan.py`, `scan-public-content.py` and `python3 -m unittest discover -s scripts/tests`.
- For org work, `README.md` lists `sf` ≥ 2 and Node ≥ 18 locally, then `sf org login web --alias <alias>`, with the alias-to-org mapping kept in `private/`.
