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
  Until revision 2 of ADR-0001 this public repo redistributed 28 skill folders (still present
  in the SMF-1 branch history and PR refs).
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
- **Update (2026-10-03, SMF-3):** the matrix (`testing/matrix.json`, `testing/MATRIX.md`) now
  has GOV-01..03 rows carrying their reviewed-pending PASS records; nothing else is open.

## C-04 — Outcome definitions are required by SMF-3 AC5 but only named elsewhere
- **Affects:** DATA-04 and every evidence record
- **Gap:** all stories name PASS/FAIL/PARTIAL/BLOCKED/NOT TESTED; none defines them.
- **Resolved (2026-10-03, SMF-3):** `testing/contract.json` → `outcomes.definitions` is final
  (wording tightened, meanings unchanged from the SMF-1 draft; the "proposed draft" note is
  removed). `outcomes.capability_area_cases` enumerates AC5's ten capability areas with the
  case IDs that test each. Changes now need a recorded project-owner decision before a run.
  Owner review happens with the SMF-3 PR.

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

## C-06 — Official test skill forbids org data; the SMF-3 access check must read the provisioned org
- **Affects:** DATA-02 (org-level row)
- **Gap:** `platform-apex-test-generate` says never rely on org data (`SeeAllData`).
  DATA-02 asks whether the *provisioned* personas can reach the *provisioned* fixtures, which a
  test that builds its own data cannot answer.
- **Meanwhile:** `MF_AccessBaselineTest` uses `@IsTest(SeeAllData=true)`, creates nothing, and
  its update probes roll back. It is a verification probe, not a unit test of production code;
  PMD reports the expected `ApexUnitTestShouldNotUseSeeAllDataTrue`. The read-only
  `baseline.py` (`UserRecordAccess`) and the cloud browser spec give two independent checks
  that do not depend on it.
- **To close:** reviewer accepts the exception for this class only (or drops the Apex probe
  and relies on `baseline.py` + the browser spec).

## C-07 — Vault saving before ADR-0004 approval (HUMAN-SETUP H7)
- **Affects:** DATA-01..03 continuity; all persona-based cloud cases
- **Gap:** the cloud addendum says SMF-3 stage 31 runs `scripts/cloud/vault.py save` after
  creating personas; HUMAN-SETUP H7 says the vault is not saved until the owner approves ADR-0004.
- **Meanwhile:** stage 31 calls `vault.py save` only when `SF_AUTH_URL_DEVHUB` is set, exactly
  like stage 20; it adds no gate of its own.
- **To close:** owner approves/rejects ADR-0004; if rejected, stages 20 and 31 both need the
  same gate (integrator change in `vault.py` or both stages).

## C-08 — Asset sharing design differs from the delegated brief
- **Affects:** DATA-02, DATA-03
- **Gap:** the delegation brief suggested TECH *Account Edit* so TECH can edit equipment under
  Asset "Controlled by Parent". With that model every account reader also reads MF-ASSET-002
  (linked to MF-CASE-002), which breaks the contract's negative control unless MF-ASSET-002
  gets a separate parent the contract does not define.
- **Meanwhile:** Asset OWD **Private** (documented in Salesforce Help, "Update the Default Asset
  Sharing Setting"); TECH gets Edit on MF-ASSET-001 by asset share and only Read on the account;
  SUPPORT gets no asset access (the contract gives SUPPORT the case, not the equipment).
- **To close:** reviewer confirms; if the org rejects the Asset OWD deploy, the fallback is a
  recorded decision on a separate parent for MF-ASSET-002.

## C-SMF5-1 — "No namespace ⇒ org-dependent" (skill) vs org-dependent packages in a scratch subscriber
- **Affects:** PKG-01..03
- **Gap:** `experience-ui-bundle-2gp-deploy` maps "no registered namespace" to the
  org-dependent unlocked flavour. Official-page excerpts (developer.salesforce.com, via web
  search; direct fetch is blocked here) say org-dependent packages "can only be installed in
  orgs that contain the metadata that the package depends on" and recommend sandboxes for
  testing them, while SMF-2 makes `smf-install-test` a scratch org. The package depends on
  no subscriber metadata, so a scratch install is expected to work, but that is unverified.
- **Meanwhile:** followed the skill (`--org-dependent --no-namespace`, the latter because
  `sf package create --help` asks for it when no namespace is defined).
- **To close:** first real install. If a scratch org refuses it, the smallest change is a
  recorded owner decision to recreate the package as plain no-namespace unlocked
  (`--no-namespace` without `--org-dependent`) — no file in this repo changes except the
  runbook command.

## C-SMF5-2 — Can a beta (unpromoted) unlocked version be upgraded?
- **Affects:** PKG-02
- **Gap:** the skill says "beta can't upgrade beta" (remedy: promote v1 or uninstall it).
  The official excerpts reachable here state this for second-generation *managed*
  packages; for unlocked packages it could not be confirmed.
- **Meanwhile:** runbook step 11 attempts the upgrade on the validated v1, records a
  refusal as a run, and only then promotes v1 (irreversible) after Brandon approves.
  Uninstall + fresh install is excluded because it is not an upgrade.
- **To close:** the first PKG-02 run.

## C-SMF5-3 — Skill step 1d deploys source to the Dev Hub; AGENTS.md says the Dev Hub is not a test org
- **Affects:** PKG-01
- **Gap:** not a true conflict: the skill deploys metadata to the Dev Hub before
  `package create`; the project rule forbids using the Dev Hub for application tests.
- **Meanwhile:** the runbook keeps step 1d (vendor skill wins for mechanics) but does no
  permission-set assignment (skill 1e), persona or test run in the Dev Hub.
- **To close:** nothing, unless the owner prefers to skip 1d (the build org is separate).

## C-SMF5-4 — Where SMF-3 fixture metadata lives (packaging boundary)
- **Affects:** PKG-01..03; DATA-01..03 (SMF-3 owns the files)
- **Gap:** SMF-3 is built in parallel and may place `MF_Case_Worker` (and other fixture
  metadata) under `force-app/`, which is the packaged directory.
- **Meanwhile:** SMF-5 added a non-packaged package directory `unpackaged/` and
  `scripts/smf5/check_package.py`, which fails if anything other than the UI bundle, its
  CustomApplication and `FieldSupport_Access` is under `force-app/`.
- **To close:** when merging SMF-3, move its fixture metadata to `unpackaged/main/default/`
  and deploy it with `--source-dir unpackaged` (SMF-3 tooling).

## C-SMF5-5 — Package build details the skill does not settle
- **Affects:** PKG-01, PKG-02
- **Gap:** (a) the official scaffold's CustomApplication references `c__FieldSupport`,
  while the skill's asset uses the bare bundle name inside a package; with no namespace both
  should resolve. (b) The skill's examples use `sourceApiVersion` 68.0; the template and
  SMF-2 R10 use 67.0. (c) No `definitionFile` is set for the version build org.
- **Meanwhile:** unchanged (SMF-4 owns the app file; 67.0 kept). `check_package.py`
  accepts either uiBundle reference.
- **To close:** if `sf package version create` rejects any of these, record the sanitized
  error as the PKG-01 run, then apply the smallest fix (bare `FieldSupport` reference via
  SMF-4; API 68.0; or a `definitionFile`) and rerun.

## C-SMF5-6 — Running SMF-3 provisioning against the subscriber org (interface SMF-5 relies on)
- **Affects:** PKG-01..03 (subscriber personas and the independently seeded MF-CASE-001)
- **Gap:** SMF-5 must seed the SMF-3 baseline in `smf-install-test` with SMF-3's own logic,
  but SMF-3's cloud stages (30–39) are being written in parallel and their interface is not
  yet fixed.
- **Meanwhile:** stage 62 runs every SMF-3 stage with `SMF_TARGET_ORG=smf-install-test` and
  expects: persona users in that org with CLI aliases `smf-install-test-{tech,support,restricted}`
  (`<org alias>-<persona>`, matching `smf-dev-<persona>`), FederationIdentifier `MF-*`,
  fixtures seeded, and record IDs under the `install-test` key of `private/fixtures.json`.
  If the aliases do not appear, stage 62 exits BLOCKED with that reason.
- **Resolved (2026-10-03, integration):** SMF-3 stages 30–34 honour `SMF_TARGET_ORG`, persona
  aliases are `<target>-tech|support|restricted`, and fixture IDs are stored under the org
  alias key (`smf-install-test`) of `private/fixtures.json`; SMF-5 reads that shape.
- **To close:** SMF-3 honours `SMF_TARGET_ORG` (default `smf-dev`) with that alias rule, or
  tells SMF-5 its interface and stage 62 is adapted.

## C-SMF7-1 — CALL-03 "expired participant authorization" cannot be produced on demand
- **Affects:** CALL-03 (and the REC-03 rejoin path that reuses a previous token)
- **Gap:** SMF-7 asks to reject "expired" participant authorization. RealtimeKit participant
  tokens are JWTs that expire exactly 100 days after issue; start/expiry cannot be configured
  (cloudflare-docs `realtimekit/concepts/participant.mdx`, `faq.mdx`). An expired token
  therefore needs one issued ≥100 days earlier.
- **Meanwhile:** the probe and cloud spec test (a) a malformed token, (b) the real token with an
  altered signature, and (c) a **revoked** token (participant deleted via the Cloudflare API) as
  the nearest available control, each recorded separately; "expired" itself stays NOT TESTED.
  Security finding recorded in `docs/smf-7/realtimekit-setup.md`: issued tokens outlive a
  removal of case access unless the participant is deleted.
- **To close:** owner decides either to accept the revoked-token control for the "expired"
  wording, or to keep "expired" open until a token is ≥100 days old (record the issue date of a
  kept test token privately).
