# Contradictions and open questions

Flagged instead of silently resolved (SMF-1 "Required Jira-to-repository handoff").
Each entry: affected case IDs, the exact gap, what was done meanwhile, and the smallest
action that closes it. Story text in Jira stays authoritative.

## C-01 — SMF-1 execution contract asks for provisioning; SMF-1 test setup forbids org mutation
- **Affects:** GOV-01..03
- **Gap:** SMF-1's shared "Agent execution contract" says to "provision or reconcile the
  specified users, grants, and synthetic fixtures needed by this story's test cases", while
  SMF-1's test setup says "no Salesforce user or org mutation required" and AC8 says
  "without changing an org".
- **Meanwhile:** followed the story-specific text; SMF-1 touched no org. GOV cases need no
  personas or fixtures.
- **Also:** the same shared paragraph appears in every story, including SMF-2, whose own scope
  leaves provisioning to SMF-3 (noticed by the GOV-02 dry run).
- **Update (2026-10-03, second SMF-1 session):** the project owner's standing execution
  rule — provision/reconcile "through the owning prerequisite stories" — is now encoded in
  `AGENTS.md` §4 and `smf-story-workflow`. It reconciles the two texts: SMF-1/SMF-2 own no
  fixtures, so they provision nothing. Remaining action is optional wording cleanup.
- **To close:** owner confirms that story-specific scope wins over the shared paragraph (or
  edits the shared paragraph to say "where this story owns provisioning").

## C-02 — Upstream licence metadata disagrees
- **Affects:** GOV-01, GOV-03 (public provenance)
- **Gap:** `forcedotcom/afv-library` at `3c15867b` ships `LICENSE.txt` = Apache-2.0, but its
  `package.json` (and the npm package `@salesforce/afv-skills`) declares CC-BY-NC-4.0.
  This public repo redistributes 28 skill folders.
- **Meanwhile:** installed from the GitHub repository (Apache-2.0 `LICENSE.txt`), recorded both
  values in `docs/provenance/official-skills.md`.
- **Resolved (2026-10-03, SMF-1 review):** the owner chose pinned, project-local
  installation on demand. Vendor copies are no longer tracked (ADR-0001 rev 2); provenance,
  per-file upstream integrity verification and a repeatable bootstrap remain. Merge PR #1
  with squash so `main` history never contains them. Upstream licence ambiguity itself is
  unchanged.
- **Original options:** owner decides whether redistribution is acceptable or to switch to
  install-on-demand (ADR-0001 option 2: git-ignore `.agents/skills/<official>` and run the
  installer in each fresh session). Optionally ask Salesforce via an upstream issue.

## C-03 — SMF-1 Definition of Done says "matrix is updated"; the matrix is initialised by SMF-3
- **Affects:** GOV-03, DATA-04
- **Gap:** SMF-3 (which depends on SMF-1) owns initialising every matrix row as NOT TESTED.
- **Meanwhile:** SMF-1 provides the matrix field list and outcome vocabulary in
  `testing/contract.json` and records its own results in `evidence/SMF-1/`; no matrix rows
  were created, so SMF-3 scope is not started.
- **To close:** owner accepts that SMF-1's matrix obligation is met by the schema + GOV
  evidence, or asks for SMF-1 rows to be added when SMF-3 initialises the matrix.

## C-04 — Outcome definitions are required by SMF-3 AC5 but only named elsewhere
- **Affects:** DATA-04 and every evidence record
- **Gap:** all stories name PASS/FAIL/PARTIAL/BLOCKED/NOT TESTED; none defines them.
- **Meanwhile:** `testing/contract.json` → `outcomes.definitions` holds draft wording, marked
  "proposed draft pending SMF-3 review", used by the `smf-evidence` skill.
- **To close:** confirm or amend the wording during SMF-3.

## C-05 — SMF-2 terms the repository cannot resolve (found by the GOV-02 dry run)
- **Affects:** ENV-01
- **Gap:** SMF-2 AC3 asks to verify "Edge requirements" (Microsoft Edge browser support, or
  Salesforce Edge network?) and "the API version needed for UIBundle packaging"; neither is
  defined in the stories, and the installed official skills cite different minimum API
  versions for other operations.
- **Meanwhile:** nothing assumed. The SMF-2 dry-run plan looks both up with
  `platform-docs-get` and labels results observed vs assumed.
- **Resolved (2026-10-03, owner clarification + SMF-2):** "Edge requirements" means the
  **Salesforce Edge Network** org prerequisite (required for the Salesforce app domain);
  **Microsoft Edge** is the separate `ENV-DESKTOP-EDGE` browser row tested from SMF-4 on.
  The UIBundle packaging API version is not stated in the docs excerpt; SMF-4/5 use the
  official template's `sourceApiVersion` 67.0 and SMF-2 checks the org supports it. See
  `docs/smf-2/platform-requirements.md`.

## C-SMF14-01 — Model delivery path: task brief vs data-access skill allowlist vs Apex heap
- **Affects:** BUDGET-03 (and the BUDGET-01/04 size range)
- **Gap:** the SMF-14 task brief suggested the standard `sobjects/ContentVersion/{id}/VersionData`
  REST endpoint as a fallback; the official `experience-ui-bundle-salesforce-data-access` skill
  lists that endpoint as not supported for UI bundles (allowlist: GraphQL, UI API REST, Apex
  REST, Connect REST, Einstein). The SMF-10 read API that SMF-14 reuses is Apex REST, which holds
  `VersionData` on the 6 MB synchronous Apex heap, so MF-MODEL-REP (8,647,528 B, within the
  SMF-3 ≤ 10 MiB contract) is expected not to be deliverable over it.
- **Meanwhile (vendor skill wins on mechanics):** VersionData REST is not used. SMF-14 offers two
  user-context paths: the SMF-10 Apex REST read API (reused unchanged) and Connect REST file
  content (`/connect/files/{documentId}/content`, platform-streamed, no Apex heap). Both are
  measured; the expected Apex-path failure for REP is recorded as a finding when the host run
  happens, not assumed.
- **To close:** first host run of `scripts/cloud/stages/57-smf14-budget.sh` records which path
  delivers each model; if Connect file content is refused in the UI-bundle host, record BUDGET-03
  for REP as FAIL/PARTIAL and decide (owner) between a smaller REP fixture (contract change) or a
  different server path.
