# AGENTS.md — Salesforce Multi-Framework PoC

Instructions for every coding agent (Claude Code, Codex, Agentforce Vibes, Cursor, …) and
human contributor working in this repository. Read this whole file before acting.
Claude Code loads it through `CLAUDE.md`.

## 1. What this project is

A capability-validation PoC for a **remote field/support use case**: a field technician
investigates an overheating pump while a remote support specialist diagnoses the same
Salesforce case. The PoC proves, one bounded probe at a time, whether the workflow can run
**inside Salesforce** — on desktop and in the **physical Salesforce mobile app** — with
camera/mic capture, two-way audio/video, screen sharing, Salesforce Files, image markup with
live sync, and 3D equipment rendering.

Technical direction (decided in the backlog, not open for redesign here):

- **Internal React UIBundle** — a Salesforce Multi-Framework (UI bundle) app for
  already-authenticated employees, scaffolded from the official `reactinternalapp` template.
- **Unlocked second-generation package (2GP)** for distribution and upgrade.
- Salesforce is the system of record for cases, equipment, users, sharing, and Files.
  External services (RealtimeKit media, tldraw sync) are bounded integrations that must
  authorize the caller against the Salesforce case.

Outcomes are evidence, not assumptions: PASS, FAIL, PARTIAL and BLOCKED are all valid
findings when evidenced and reviewed.

## 2. Where the work is defined (read before acting)

The backlog lives in Jira project **SMF** on `answersllc.atlassian.net`. Jira is
authoritative; this repository holds a dated read-only snapshot for agents without Jira access.

Before any task:

1. Read the **assigned story** in full (current Jira description; fall back to
   `docs/jira-snapshot/` and say you did).
2. Read every story it names under **Dependencies**.
3. Read **SMF-3** — the shared personas, fixtures, environments, evidence fields, and
   Definition of Done. Its contract is captured in `testing/contract.json`.
4. Look up the story's case IDs in `testing/test-plan-index.json`. Those case IDs are the
   acceptance criteria. Do not invent, drop, merge, or relax them.

| Need | Location |
|---|---|
| Story ↔ case-ID index (16 stories, 54 cases) with each story's personas, fixtures, test data, expected results and required evidence | `testing/test-plan-index.json` (human view: `testing/README.md`) |
| Personas, fixtures, environments, outcomes, evidence fields, DoD | `testing/contract.json` |
| Dated Jira text (fallback only) | `docs/jira-snapshot/2026-10-03/SMF-<n>.md` |
| Flagged contradictions / open questions | `docs/contradictions.md` |
| Evidence records | `evidence/SMF-<n>/<CASE-ID>.md` (template: `evidence/TEMPLATE.md`) |
| PoC briefs | `docs/poc-briefs/` |
| Architecture decisions | `docs/adr/` |
| Official-skill provenance | `docs/provenance/official-skills.md` |

## 3. Skills: select the relevant skill before working

Two kinds of skill are installed **at project scope** (nothing machine-global is required):

- **Official Salesforce skills** from `forcedotcom/afv-library`, pinned to a single upstream
  revision (see `skills-lock.json` and `docs/provenance/official-skills.md`). They are
  **authoritative for platform mechanics**: org/CLI operations, UIBundle scaffolding,
  metadata, permission sets, sharing, data, packaging, deploy. Do not hand-roll what an
  official skill covers, and do not edit their files — reinstall instead.
- **Project skills** (`smf-*`) — short, project-specific rules for *how this PoC works*:
  probe scope, integration boundaries, physical-mobile testing, evidence, review, provenance.
  They never override vendor guidance on platform mechanics; if they appear to, record it in
  `docs/contradictions.md` and follow the vendor skill.

Locations: canonical copies in `.agents/skills/<name>/SKILL.md` (Codex and other Agent
Skills tools); `.claude/skills/<name>` symlinks to them (Claude Code). Never install skills
globally (`-g`) for this project.

**Before starting work, pick skills explicitly and name them in your plan/PR**:

| Work | Project skills | Official skills |
|---|---|---|
| Any story | `smf-story-workflow`, `smf-evidence` | — |
| Org identity, Dev Hub, scratch/test orgs (SMF-2) | `smf-salesforce-boundaries` | `dx-org-devhub-configure`, `dx-org-manage`, `dx-org-switch`, `dx-org-analyze`, `dx-org-trial-expiration-check`, `platform-docs-get` |
| Users, permission sets, sharing, fixtures (SMF-3) | `smf-salesforce-boundaries` | `platform-permission-set-generate`, `dx-org-permission-set-assign`, `platform-sharing-owd-configure`, `platform-sharing-rules-generate`, `platform-data-manage`, `platform-soql-query` |
| UIBundle app scaffold / UI / data access (SMF-4+) | `smf-capability-probe` | `experience-ui-bundle-app-coordinate`, `experience-ui-bundle-project-generate`, `experience-ui-bundle-metadata-generate`, `experience-ui-bundle-frontend-generate`, `experience-ui-bundle-salesforce-data-access`, `experience-ui-bundle-custom-app-generate`, `design-systems-slds-apply` |
| Salesforce Files (SMF-10/11) | `smf-salesforce-boundaries` | `experience-ui-bundle-file-upload-generate` |
| Deploy, unlocked 2GP (SMF-4/5/16) | — | `experience-ui-bundle-deploy`, `experience-ui-bundle-2gp-deploy`, `platform-metadata-deploy`, `platform-metadata-retrieve` |
| Apex (server-side authorization, tokens) | `smf-salesforce-boundaries` | `platform-apex-generate`, `platform-apex-test-generate`, `platform-apex-test-run`, `dx-code-analyzer-run` |
| Device / mobile tests (SMF-4,6–9,13,14,16) | `smf-physical-mobile-testing` | — |
| Reviewing a PR or evidence | `smf-review` | `dx-code-analyzer-run` |
| Anything published (PRs, docs, logs) | `smf-public-provenance` | — |

If no listed skill fits, say so in the plan rather than guessing a vendor skill name.
Upstream skill names change between releases; only names present in `.agents/skills/` exist.

## 4. Task lifecycle

**Standing execution rule.** Agents implement the assigned story's defined test plan
(its case IDs in `testing/test-plan-index.json`). They provision or reconcile that plan's
specified test users, grants, and fixtures **through the owning prerequisite stories**
(`testing/contract.json` → `fixture_provisioning_ownership`; e.g. SMF-3 owns baseline
users/grants/cases/Files, SMF-7 provider rooms/tokens, SMF-12 collaboration service,
SMF-11/12 markup artifacts, SMF-13/14 3D fixtures). They may delegate those exact tasks —
naming the story/case IDs, personas, fixtures, expected outcomes, and evidence to return —
but must verify the returned evidence themselves. They do not invent personas, omit
negative/denial tests, weaken acceptance criteria or thresholds, or expand into unrelated
stories. SMF-3's MF-ADMIN, MF-TECH, MF-SUPPORT, MF-RESTRICTED and MF-* fixtures are
**specifications, not proof that accounts or data exist**: check for verified evidence
from the owning story before relying on them; if absent, record the affected case ID as
BLOCKED with the smallest unblocking action.

Jira status flow: **To Discuss → In Progress → Testing → Done**. Use Jira's *Flagged*
(blocked) marker with a comment giving reason and next action when blocked.

1. **Read** the story, its dependencies, SMF-3, and this file (§2). Move the story to
   *In Progress* when work starts.
2. **Resolve scope and dependencies.** A dependency needs a supported result or an explicit
   recorded fallback/scope decision. Do not start unrelated stories.
3. **Prepare acceptance tests** for the story's case IDs: personas, fixtures, environment
   rows, steps, expected result — before implementing.
4. **Implement one probe** — the smallest thing that answers the story's question
   (`smf-capability-probe`).
5. **Verify** against each case ID. Automated checks where meaningful; physical-device
   and subjective A/V checks by Brandon or a designated tester.
6. **Attach evidence and limitations** per case ID (`smf-evidence`). Move to *Testing*
   while evidence is pending or under review.
7. **Update the capability matrix** (owned/initialised by SMF-3).
8. **Submit a reviewable PR and handoff**: draft PR per story, case-ID results table,
   selected skills, limitations, and what remains. *Done* only after evidence is reviewed.

## 5. Non-negotiable rules

- **Explicit org targeting.** Every `sf` command that touches an org passes
  `--target-org <alias>` (or the skill's equivalent). Never rely on an implicit default org.
  Verify org identity before any write. The Dev Hub is not the application test org.
- **Synthetic data only.** Use the fixtures in `testing/contract.json`. No customer data.
- **Keep out of Git and public logs:** passwords, passkeys, tokens, `sf` auth files/exports
  (`.sf/`, `.sfdx/`, `*.authfile`, `sfdxAuthUrl`), private org IDs, real usernames,
  provider room IDs/participant tokens, raw private conversations. Real persona↔username
  and record-ID mappings live only in `private/` (git-ignored; format in
  `docs/private-mapping-format.md`) or a credential store.
- **Preserve curated provenance:** task instructions, decisions, changes, and verification
  results go in the repo (`docs/provenance/`, `evidence/`, ADRs) — summarised, not raw transcripts.
- **Done ≠ PASS.** Done means the evidence was reviewed. A reviewed FAIL or PARTIAL can be
  Done. A missing required test keeps the story in Testing or blocked unless Brandon
  explicitly accepts reduced scope, and the excluded coverage stays visible.
- **Never infer Salesforce mobile support** from localhost, desktop, a mobile browser, or an
  emulator. Those are separate evidence rows. Missing device ⇒ BLOCKED / NOT TESTED.
- **Never relax a target after a failure.** Threshold changes need a recorded project-owner
  decision before the run.
- **Conflicts:** record the case ID, the exact gap, and the smallest unblocking action in
  the story (and `docs/contradictions.md`). Don't ask the owner to redesign specified
  users, data, or tests. Human requests name a specific interaction (e.g. a passkey prompt).

## 6. Repository layout

```
AGENTS.md / CLAUDE.md        agent instructions (this file)
skills-lock.json             pinned official skills (written by the skills CLI)
.agents/skills/              official + smf-* skills (canonical)
.claude/skills/              symlinks for Claude Code
docs/adr/                    architecture decision records (template: 0000)
docs/poc-briefs/             one brief per PoC story (template + index)
docs/provenance/             official-skill provenance, curated session records
docs/jira-snapshot/          dated, read-only copy of SMF story text
docs/dry-runs/               bounded planning dry runs (SMF-1 GOV-02: SMF-2 plan)
testing/                     test-plan index, shared contract, matrix schema
evidence/                    per-story, per-case evidence records
scripts/                     install/verify tooling (no org access)
private/                     git-ignored; local-only mappings, never committed
```

The **official Salesforce app scaffold is not generated yet.** Per ADR-0002 it will be
generated by SMF-4 with `experience-ui-bundle-project-generate` (template
`reactinternalapp`) at the repository root (`sfdx-project.json`,
`force-app/main/default/uiBundles/<AppName>/`), generated into a temp directory and merged
so it cannot overwrite this file, `README.md`, or `.gitignore`.

## 7. Checks to run before a PR

```
python3 scripts/verify-skills.py        # skills discoverable, pinned, unmodified
python3 scripts/check-test-plan.py      # 54 case IDs, each owned by exactly one story
python3 scripts/scan-public-content.py  # no credentials / private identifiers
```
