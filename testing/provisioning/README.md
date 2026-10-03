# SMF-3 provisioning kit

Reproducible setup for the SMF-3 personas, synthetic fixtures and access baseline
(DATA-01..04). **Nothing here has been executed against an org yet**: SMF-2 ENV-01..03 are
BLOCKED (no org credential; egress to Salesforce denied). Every result is recorded in
`evidence/SMF-3/` only after a real run.

Skills used: `smf-story-workflow`, `smf-evidence`, `smf-salesforce-boundaries`,
`smf-physical-mobile-testing`, `smf-public-provenance`; official `platform-permission-set-generate`,
`dx-org-permission-set-assign`, `platform-sharing-owd-configure`, `platform-sharing-rules-generate`,
`platform-data-manage`, `platform-soql-query`, `platform-apex-test-generate`, `dx-code-analyzer-run`.

## Run order (cloud pipeline stages; every command names its org)

| Stage | Command | Case |
|---|---|---|
| 30 | `sf project deploy start --metadata-dir testing/provisioning/metadata --target-org smf-dev` then `python3 testing/provisioning/fixtures.py preflight --target-org smf-dev` | DATA-03 prerequisite |
| 31 | `python3 testing/provisioning/personas.py --target-org smf-dev --reconcile`, then `python3 scripts/cloud/vault.py save` | AC1, DATA-03 |
| 32 | `python3 testing/provisioning/fixtures.py seed-twice --target-org smf-dev --report evidence/SMF-3/runs/<date>-DATA-01.json` | DATA-01 |
| 33 | `python3 testing/provisioning/baseline.py --target-org smf-dev --report evidence/SMF-3/runs/<date>-DATA-03-baseline.md` | DATA-03, DATA-02 (org) |
| 34 | `python3 testing/provisioning/access_tests.py --target-org smf-dev --report evidence/SMF-3/runs/<date>-DATA-02-apex.json` | DATA-02 (org) |
| 51 | `npx playwright test tests/smf-3-access.spec.ts` in `testing/cloud-e2e` (Edge, cloud Chromium) | DATA-02 desktop rows |
| — | Human scripts `docs/test-scripts/ENV-*.md` | DATA-02 interactive login + mobile rows |
| 90 | `python3 scripts/build-matrix.py --sync` | DATA-04 |
| reset | `python3 testing/provisioning/fixtures.py reset --target-org smf-dev --reseed` | DATA-04 |

The stage files are `scripts/cloud/stages/{30,31,32,33,34,51,90}-smf3-*.sh` (run by the
integrator's `scripts/cloud/pipeline.sh`). They exit 0 done, 2 BLOCKED (reason printed), other = failure.

## Design

**Org-wide defaults** (`metadata/objects/*.object`, official `platform-sharing-owd-configure`
mechanism: `CustomObject.sharingModel` / `externalSharingModel`): Account, Case and Asset
internal and external **Private**. Asset uses its own Private model instead of *Controlled by
Parent* (supported per Salesforce Help "Update the Default Asset Sharing Setting"), so
MF-ASSET-002 can sit under MF-ACCOUNT-001 without becoming visible to anyone who can read the
account, and TECH gets equipment edit through an asset share instead of account edit. The skill
notes that Account = Private forces Contact/Opportunity/Case to Private too. Preflight and
`baseline.py` read the result back from `EntityDefinition` (Tooling API) — the deploy is not
assumed to have worked.

**No sharing rules** are created. `baseline.py` proves non-exposure from the share rows of every
fixture record (owner + baseline manual shares only; any rule/group/other row is a deviation)
and also retrieves `SharingRules:Account/Case/Asset` privately for context.

**Permission set `MF_Case_Worker`** (`metadata/permissionsets/`, official
`platform-permission-set-generate`): Case read/edit, Account read, Asset read/edit; no create,
delete, View All or Modify All; FLS only on non-required standard fields the PoC uses
(Case.Subject/Description/AssetId, Asset.SerialNumber/Description). Assigned to MF-TECH and
MF-SUPPORT only. App access (`FieldSupport_Access`) belongs to SMF-4 and is assigned to all three
personas once it exists. No permission that waives MFA or relaxes login security is used.

**Personas** (`personas.py`): licence check first (free *Salesforce* licences ≥ personas still to
create — 3 on a first run — otherwise BLOCKED, exit 3), profile *Minimum Access - Salesforce*
verified by query, no role, `sf org create user` (scratch orgs) with `FederationIdentifier` =
logical persona ID and CLI aliases `smf-dev-tech|-support|-restricted`. Random usernames at
`example.com`, no real names. Email = `$SMF_TESTER_EMAIL` when set (HUMAN-SETUP H6) so the
device tester receives verification/reset mail; otherwise `example.com`. The CLI generates the
password and keeps it in its credential store (carried across sessions by the encrypted vault,
ADR-0004); nothing prints it. Real usernames/IDs → `private/personas.json`.

**Grants** (seed): manual shares only, reconciled each run to exactly
MF-CASE-001: TECH Edit, SUPPORT Edit · MF-ACCOUNT-001: TECH Read, SUPPORT Read (Case and
Opportunity access via the account share = None) · MF-ASSET-001: TECH Edit ·
MF-CASE-002 / MF-ASSET-002: none · MF-RESTRICTED: nothing. MF-CASE-002 and MF-ASSET-002 are
owned by MF-ADMIN (the running admin), not by a business persona.

**Fixtures and identity keys** (`apex/seed.apex`, standard fields only, checked by describe in
preflight per `platform-data-manage`):

| Logical ID | Key | Values |
|---|---|---|
| MF-ACCOUNT-001 | `Account.Name` | CollabTech PoC Test Customer |
| MF-ASSET-001 | `Asset.SerialNumber` | MF-ASSET-001, Name MF-PUMP-001 |
| MF-ASSET-002 | `Asset.SerialNumber` | MF-ASSET-002 |
| MF-CASE-001 | `Case.Subject` + `AccountId` | Pump overheating — remote diagnosis (open; Asset MF-ASSET-001) |
| MF-CASE-002 | `Case.Subject` + `AccountId` | MF-CASE-002 restricted negative control (synthetic) (Asset MF-ASSET-002) |
| MF-IMAGE-001 | `ContentVersion.Title`, IsLatest, owner MF-ADMIN | linked only to MF-CASE-001, ShareType V |
| MF-FILE-DENIED | `ContentVersion.Title`, IsLatest, owner MF-ADMIN | linked only to MF-CASE-002, ShareType V |

**Image Files**: anonymous Apex cannot carry the binaries (script size limits), and a static
resource would make MF-FILE-DENIED readable by every user through its `/resource/` URL. So
`fixtures.py` uploads each image with `sf data create file --title <logical id>` (no parent:
private to MF-ADMIN), verified against `testing/fixtures/manifest.json` first; the seed then
links it with `ContentDocumentLink` ShareType `V`, Visibility `AllUsers`, and deletes any
`ContentDistribution` (public link) on fixture Files. `ContentVersion.Checksum` (MD5) is
compared with the manifest's `md5`.

**Idempotency** (DATA-01): every fixture is looked up by its key before anything is created;
duplicates are reported, never silently merged. `seed-twice` compares counts and — privately —
the record IDs per key between the two runs, printing only booleans.

**Reset** (`apex/reset.apex`): deletes only records with fixture keys (Files, cases, assets,
account); aborts without deleting if MF-ACCOUNT-001 has non-fixture children (deleting the
account would cascade). Users are never deleted; `personas.py --reconcile` restores their baseline.

**Access verification**
- `baseline.py` (read-only, DATA-03 + org-level DATA-02): OWD, profile, licence, role, active,
  permission sets, group/queue membership, View/Modify All Data, effective object permissions,
  share rows, File links/public links/bytes, and `UserRecordAccess` per persona × fixture.
- `apex-tests/` `MF_AccessBaselineTest` (`@IsTest(SeeAllData=true)`, `System.runAs` + `WITH
  USER_MODE`): 17 single-behaviour methods — TECH/SUPPORT read+edit MF-CASE-001 and read
  MF-IMAGE-001, TECH read+edit MF-ASSET-001, RESTRICTED denied all, every persona denied
  MF-CASE-002, MF-ASSET-002, MF-FILE-DENIED, no public links. Update attempts roll back with
  the test. `SeeAllData=true` deviates from the official test skill's rule on purpose (see
  `docs/contradictions.md` C-06). runAs does not prove UI login.
- Cloud browser spec `testing/cloud-e2e/tests/smf-3-access.spec.ts`: each persona's own session
  (frontdoor URL from its CLI auth) opens the case pages and downloads the Files; MF-IMAGE-001
  bytes must match the manifest hash.
- Human scripts `docs/test-scripts/ENV-*.md`: interactive password/MFA login and every mobile row.

## Static analysis

`sf code-analyzer run --workspace testing/provisioning/apex-tests --rule-selector pmd`
(2026-10-03, code-analyzer 5.16.0, PMD, offline): remaining findings are the intended
`ApexUnitTestShouldNotUseSeeAllDataTrue` (High) and `ApexUnitTestClassShouldHaveRunAs` (Low,
the public-link method runs as the admin by design). Anonymous Apex (`.apex`) is not a PMD
target and was reviewed by hand. No Apex was compiled or run against an org.

## Known risks to check on the first real run

- Whether deploying `Asset.object` with `sharingModel` Private succeeds on the org's API version
  (Help documents the setting; the metadata path is the skill's mechanism, not yet observed).
- FLS entries for standard fields: a field the org treats as not FLS-controllable fails the
  permission-set deploy (the skill's documented failure mode); remove that entry, record why.
- `UserRecordAccess` may not report `ContentDocument` access; then File access rests on the
  Apex test and the browser spec (reported as such, not as PASS).
- Minimum Access users may lack Lightning Experience / mobile permissions; the human scripts
  record what happens. Granting extra system permissions needs a recorded owner decision.
