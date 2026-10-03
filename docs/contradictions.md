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
- **To close:** resolved during SMF-2 from current official documentation; if "Edge" stays
  ambiguous, owner clarifies in SMF-2.
