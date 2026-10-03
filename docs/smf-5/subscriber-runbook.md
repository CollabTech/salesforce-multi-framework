# SMF-5 — unlocked 2GP create / install / upgrade runbook (PKG-01..03)

Repeatable operator runbook for [SMF-5](https://answersllc.atlassian.net/browse/SMF-5).
Mechanics follow the official skill `experience-ui-bundle-2gp-deploy` (afv-library, pinned
in `skills-lock.json`); org targeting and data rules follow `smf-salesforce-boundaries`;
permission-set assignment follows `dx-org-permission-set-assign`. Human launch and denial
steps are in [`docs/test-scripts/SMF-5-PKG.md`](../test-scripts/SMF-5-PKG.md).

**Status (2026-10-03):** written and checked offline only. No step below has been run
against an org: SMF-2 ENV-01..03 are BLOCKED (no org credential; egress to Salesforce
denied), so PKG-01..03 are BLOCKED (`evidence/SMF-5/`).

## Decisions (what is packaged and how)

| # | Decision | Why |
|---|---|---|
| P1 | **Flavour: unlocked, org-dependent, no namespace** (`namespace: ""`, `sf package create --package-type Unlocked --org-dependent --no-namespace`) | Skill flavour table: no registered namespace ⇒ org-dependent unlocked. `--no-namespace` is what `sf package create --help` asks for when `sfdx-project.json` has no namespace. See C-SMF5-1 for the scratch-org caveat. |
| P2 | **Package `FieldSupportPoC` = package directory `force-app`**, which must contain exactly `UIBundle:FieldSupport`, `CustomApplication:FieldSupport`, `PermissionSet:FieldSupport_Access` (R9 in `docs/smf-2/platform-requirements.md`) | `python3 scripts/smf5/check_package.py` enforces the exact set. |
| P3 | **Test fixtures are never packaged.** SMF-3 persona permission sets (`MF_Case_Worker`) and fixture metadata go in `unpackaged/` (a package directory with no `package` key: deployable, never in a version) | Personas and the MF-CASE-001 baseline are seeded *independently* in the subscriber (story test data). Packaging them would make the package prove its own fixtures. |
| P4 | `versionNumber` `1.0.0.NEXT` (v1) and `1.1.0.NEXT` (v2); `versionName` "v1 launch baseline" / "v2 upgrade marker". **No `ancestorId`/`ancestorVersion`**: ancestors are a managed-2GP concept; an unlocked version upgrades any lower installed version | `scripts/smf5/set_version.py v1\|v2` sets both the project file and the visible marker. |
| P5 | **v2 change = one constant.** `src/probes/smf-05-version/packageVersion.ts` `PACKAGE_MARKER` goes from `v1 (1.0.0)` to `v2 (1.1.0)`; shown on *Probes → Package version marker* (route `/probes/package-version`). Nothing else differs | Minimal, user-visible proof that the upgrade replaced the served bundle. `check_package.py` fails if the marker and `versionNumber` disagree. |
| P6 | **Validated builds with `--code-coverage`; no `--skip-validation`** | Skill: `--skip-validation` gives a beta that cannot be promoted. v1/v2 contain no Apex, so coverage is trivially met; the flag keeps them promotable if the upgrade needs it (step 11). |
| P7 | **`--installation-key-bypass`** (no installation key) | Source is public in this repository and contains no secrets; a key would add a credential to manage without protecting anything. The `04t` IDs are still kept private. |
| P8 | **`--security-type AdminsOnly`** on install | Access is granted only through `FieldSupport_Access` assignments, which is what PKG-01 ("assign intended access") and PKG-03 (denial) test. |
| P9 | **IDs private, reports sanitized.** `0Ho`/`04t`/`05i`/`08c`/`0Hf` IDs and raw `--json` output go to `private/` (git-ignored); only `scripts/smf5/sanitize_report.py` output is published | AGENTS.md §5; story AC2 "retain operation IDs privately and sanitized reports publicly". `scan-public-content.py` now flags package/operation IDs. |
| P10 | **No external services or credentials in v1/v2.** No Named/External Credential, CSP Trusted Site, Remote Site, Connected App or custom setting is packaged or needed | Story AC3 asks to document them: subscriber-side configuration is listed in "Configured separately in the subscriber" below. |

## Orgs (explicit targets only)

| Alias | Role here | Never used for |
|---|---|---|
| `smf-devhub` | Owns the package; builds versions; skill step 1d source deploy | Persona tests, installs |
| `smf-install-test` | Subscriber: install, upgrade, persona checks (SMF-2 `setup-path.md` step 4 creates it) | Package creation |
| `smf-dev` | Not used by SMF-5 | — |

Every command names `--target-dev-hub smf-devhub` or `--target-org smf-install-test`.
Never set a default org.

## Private files (git-ignored)

`private/packages.json` (format also in `docs/private-mapping-format.md`):

```json
{ "package": { "name": "FieldSupportPoC", "id": "<0Ho…>" },
  "versions": { "v1": { "request": "<08c…>", "id": "<04t…>", "number": "<1.0.0.n>", "commit": "<sha>" },
                "v2": { "request": "<08c…>", "id": "<04t…>", "number": "<1.1.0.n>", "commit": "<sha>" } },
  "installs": { "v1": "<0Hf…>", "v2": "<0Hf…>" } }
```

Raw CLI output: `private/smf5/*.json`. **`sf package create` and `sf package version create`
write `packageAliases` (with `0Ho`/`04t` IDs) into `sfdx-project.json`.** Keep that edit
local while working, copy the IDs into `private/packages.json`, and run
`git checkout -- sfdx-project.json` before committing; `check_package.py` fails while IDs
are present.

## Configured separately in the subscriber (not in the package)

| Item | Owner / how | Needed by |
|---|---|---|
| Salesforce Multi-Framework app domain enabled; Salesforce Edge Network | Brandon, Setup (SMF-2 `setup-path.md` step 5 for `smf-install-test`) | App renders at all |
| MF-ADMIN/TECH/SUPPORT/RESTRICTED users in the install-test org | SMF-3 tooling, run with `--target-org smf-install-test` | PKG-01..03 |
| `MF_Case_Worker` and other fixture permission sets; MF-CASE-001, MF-IMAGE-001 (and the rest of the SMF-3 baseline) | SMF-3 tooling (`unpackaged/` + seed) | PKG-02 state check |
| `FieldSupport_Access` assignments to TECH, SUPPORT, RESTRICTED | Step 7 | PKG-01, PKG-03 |
| External services, credentials | **None for v1/v2.** Later probes (SMF-7 RealtimeKit, SMF-12 tldraw sync) will need subscriber-side External Credential principals / CSP entries; that is SMF-16 packaging scope | — |

## Steps

Set once per shell: `export SF_DISABLE_TELEMETRY=true`;
`B=force-app/main/default/uiBundles/FieldSupport`; `mkdir -p private/smf5 evidence/SMF-5/reports`.

### 0. Preconditions (stop and record BLOCKED if any fails)

```sh
python3 scripts/bootstrap-skills.py && python3 scripts/verify-skills.py
sf org display --target-org smf-devhub --json | jq '{isDevHub: .result.isDevHub, api: .result.apiVersion}'
# 2GP gate (skill): records/"0 records" = ON; "sObject type 'Package2' is not supported" = OFF
sf data query --target-org smf-devhub --use-tooling-api --query "SELECT Id FROM Package2 LIMIT 1" --json | jq '.status'
sf org list limits --target-org smf-devhub --json | jq '.result[] | select(.name=="Package2VersionCreates" or .name=="DailyScratchOrgs")'
sf org display --target-org smf-install-test --json | jq '{api: .result.apiVersion, status: .result.status}'
```

- If `Package2` is not supported: Brandon turns on **Setup → Dev Hub → Enable Unlocked
  Packages and Second-Generation Managed Packages** (no CLI equivalent), then re-auth.
- Confirm privately that `smf-install-test` and `smf-devhub` are different orgs (org IDs in
  `private/orgs.json`; never print them in evidence).
- `Package2VersionCreates` remaining ≥ 2 (v1 + v2). API ≥ 67.0 on both orgs.
- SMF-2 manual Setup observations recorded for `smf-install-test` (app domain, Edge Network).

### 1. Build and offline package check (v1)

```sh
python3 scripts/smf5/set_version.py v1          # no-op on a clean v1 checkout
(cd $B && npm ci && npm run lint && npx vitest run && VITE_BUILD_COMMIT=$(git rev-parse --short HEAD) npm run build)
python3 scripts/smf5/check_package.py --built   # exact members, marker == versionNumber, dist/ present
git status --porcelain                          # must be empty: the version must map to a commit
```

Record `V1_COMMIT=$(git rev-parse HEAD)` in `private/packages.json`.

### 2. Skill step 1d — deploy source to the Dev Hub

```sh
sf project deploy start --source-dir force-app --target-org smf-devhub --api-version 67.0 --wait 30
```

Metadata only: no permission-set assignment, persona or test runs in the Dev Hub
(C-SMF5-3). If this fails on a Multi-Framework prerequisite of the Dev Hub, record the
sanitized error and continue — the version build org is separate.

### 3. Create the package (once)

```sh
sf package create --name FieldSupportPoC --package-type Unlocked --org-dependent --no-namespace \
  --path force-app --description "SMF-5 Field Support PoC (FieldSupport UI bundle)" \
  --target-dev-hub smf-devhub --json > private/smf5/package-create.json
jq -r '.result.Id' private/smf5/package-create.json   # -> private/packages.json package.id
```

### 4. Create version v1 (async submit + poll, per the skill)

```sh
REQ=$(sf package version create --package FieldSupportPoC --installation-key-bypass --code-coverage \
  --target-dev-hub smf-devhub --json | tee private/smf5/v1-create-submit.json | jq -r '.result.Id')
while :; do
  J=$(sf package version create report -i "$REQ" --target-dev-hub smf-devhub --json)
  ST=$(echo "$J" | jq -r '.result[0].Status'); echo "status: $ST"
  case "$ST" in Success|Error) echo "$J" > private/smf5/v1-create-report.json; break;; esac
  sleep 30
done
V1=$(jq -r '.result[0].SubscriberPackageVersionId' private/smf5/v1-create-report.json)
sf package version report --package "$V1" --target-dev-hub smf-devhub --json > private/smf5/v1-version-report.json
python3 scripts/smf5/sanitize_report.py < private/smf5/v1-create-report.json  > evidence/SMF-5/reports/v1-create-report.json
python3 scripts/smf5/sanitize_report.py < private/smf5/v1-version-report.json > evidence/SMF-5/reports/v1-version-report.json
git checkout -- sfdx-project.json     # drop CLI-written packageAliases after saving the IDs privately
```

Save `REQ`, `V1` and the version number (e.g. `1.0.0.1`) in `private/packages.json`. On
`Error`, the sanitized report is the PKG-01 result (FAIL/BLOCKED with the error text).
Resume a timed-out poll with the same `REQ`.

### 5. Seed the subscriber baseline independently (SMF-3 tooling)

Run SMF-3's provisioning against the install-test org, exactly as SMF-3's runbook states
(names below are those referenced in `docs/smf-4/deploy.md`; use SMF-3's final names):

```sh
python3 testing/provisioning/create_personas.py --target-org smf-install-test
python3 testing/provisioning/check_baseline.py  --target-org smf-install-test
```

This deploys `unpackaged/` fixture metadata, creates the four personas and seeds
MF-CASE-001/MF-IMAGE-001 (and the rest of the baseline). Record the SMF-3 DATA evidence for
the install-test org; without it PKG-01..03 stay BLOCKED (AGENTS.md §4).

### 6. Install v1

```sh
sf package install --package "$V1" --target-org smf-install-test --security-type AdminsOnly \
  --wait 20 --publish-wait 10 --no-prompt --json > private/smf5/install-v1.json
# --wait can exit 0 while IN_PROGRESS (skill): confirm, polling for a few minutes if empty
sf package installed list --target-org smf-install-test --json > private/smf5/installed-after-v1.json
jq -r --arg v "$V1" '.result[]? | select(.SubscriberPackageVersionId==$v) | .SubscriberPackageVersionNumber' private/smf5/installed-after-v1.json
python3 scripts/smf5/sanitize_report.py < private/smf5/install-v1.json            > evidence/SMF-5/reports/install-v1.json
python3 scripts/smf5/sanitize_report.py < private/smf5/installed-after-v1.json    > evidence/SMF-5/reports/installed-after-v1.json
```

Stuck: `sf package install report --request-id <0Hf…> --target-org smf-install-test --json`.

### 7. Assign intended access

```sh
# usernames: SMF-3's private persona mapping for the install-test org (never in Git)
sf org assign permset --name FieldSupport_Access --on-behalf-of '<MF-TECH username>' \
  --on-behalf-of '<MF-SUPPORT username>' --on-behalf-of '<MF-RESTRICTED username>' --target-org smf-install-test
python3 testing/provisioning/check_baseline.py --target-org smf-install-test
```

(Or rerun SMF-3's `create_personas.py`, which assigns `FieldSupport_Access` once the
permission set exists.) MF-ADMIN gets no app assignment for evidence purposes.

### 8. PKG-01 launch check (human)

Brandon runs `docs/test-scripts/SMF-5-PKG.md` § PKG-01 as MF-TECH and MF-SUPPORT in
`smf-install-test`. Expected: app listed and launches, correct user, marker **v1 (1.0.0)**.

### 9. PKG-03 denial check (human + admin)

`docs/test-scripts/SMF-5-PKG.md` § PKG-03: remove `FieldSupport_Access` from MF-RESTRICTED,
confirm the app is neither listed nor reachable, restore, re-run `check_baseline.py`.

```sh
# admin removal (query the assignment Id, then delete by Id; ID stays in private/)
sf data query --target-org smf-install-test --json --query \
  "SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'FieldSupport_Access' AND Assignee.Username = '<MF-RESTRICTED username>'" \
  > private/smf5/restricted-psa.json
sf data delete record --sobject PermissionSetAssignment --record-id "$(jq -r '.result.records[0].Id' private/smf5/restricted-psa.json)" --target-org smf-install-test
# restore
sf org assign permset --name FieldSupport_Access --on-behalf-of '<MF-RESTRICTED username>' --target-org smf-install-test
```

### 10. Build and create v2

```sh
python3 scripts/smf5/set_version.py v2
git commit -am "SMF-5: package v2 marker (PACKAGE_MARKER v2, versionNumber 1.1.0.NEXT)"
(cd $B && npm run lint && npx vitest run && VITE_BUILD_COMMIT=$(git rev-parse --short HEAD) npm run build)
python3 scripts/smf5/check_package.py --built
```

Then repeat step 4 with `v2` in every file name (`private/smf5/v2-*.json`,
`evidence/SMF-5/reports/v2-*.json`); save `V2`, its number (e.g. `1.1.0.1`) and the commit.

### 11. Upgrade v1 → v2 with state checks

```sh
python3 scripts/smf5/state_snapshot.py snapshot --target-org smf-install-test --label before-v2
sf data query --target-org smf-install-test --json --query \
  "SELECT COUNT() FROM PermissionSetAssignment WHERE PermissionSet.Name = 'FieldSupport_Access'" | jq '.result.totalSize'
sf package install --package "$V2" --target-org smf-install-test --upgrade-type Mixed --security-type AdminsOnly \
  --wait 20 --publish-wait 10 --no-prompt --json > private/smf5/install-v2.json
sf package installed list --target-org smf-install-test --json > private/smf5/installed-after-v2.json
python3 scripts/smf5/state_snapshot.py snapshot --target-org smf-install-test --label after-v2
python3 scripts/smf5/state_snapshot.py compare before-v2 after-v2      # expect "identical": true
# repeat the PermissionSetAssignment COUNT() — expect the same number
python3 testing/provisioning/check_baseline.py --target-org smf-install-test
python3 scripts/smf5/sanitize_report.py < private/smf5/install-v2.json         > evidence/SMF-5/reports/install-v2.json
python3 scripts/smf5/sanitize_report.py < private/smf5/installed-after-v2.json > evidence/SMF-5/reports/installed-after-v2.json
```

**If the upgrade is refused with "Cannot upgrade beta package"** (the skill says beta cannot
upgrade beta; whether this applies to unlocked versions could not be confirmed from the
official pages, C-SMF5-2): record the sanitized report as the first PKG-02 run. The skill's
remedy is to promote v1 — **irreversible, so only after Brandon approves it in the story**:
`sf package version promote --package "$V1" --target-dev-hub smf-devhub`. Then rerun this
step and record it as a second run. Do not uninstall v1 and fresh-install v2: that is not
an upgrade.

Then Brandon runs `docs/test-scripts/SMF-5-PKG.md` § PKG-02 (marker shows **v2 (1.1.0)**
for TECH and SUPPORT without re-assignment; launch check still works).

### 12. Evidence and publication

- Fill `evidence/SMF-5/PKG-0n-<ENV-ROW>.md` from `evidence/TEMPLATE.md` (`scripts/evidence.py`):
  commit SHAs, version **numbers** (never `04t`), sanitized report paths, tester.
- `python3 scripts/scan-public-content.py`, review every file in `evidence/SMF-5/reports/`
  by eye, `python3 scripts/smf5/check_package.py` (no committed aliases).
- Leave v2 installed in `smf-install-test` for SMF-15/16 unless Brandon asks to uninstall
  (`sf package uninstall --package "$V2" --target-org smf-install-test --wait 20`).

## Known limitations and risks (not results)

- The bundle ships its source as well as `dist/` (unlocked packages are readable by the
  subscriber; skill runtime model). Offline payload: 87 files, about 2.2 MiB (`check_package.py --built`).
- Probe UI added later by other stories lands inside the same bundle; any server-side
  metadata they add under `force-app` makes `check_package.py` fail on purpose — what the
  vertical-slice package contains is SMF-16's decision.
- Unlocked upgrades overwrite subscriber edits to the bundle; org-dependent has no rollback
  on a failed upgrade (skill).
- Version build org: no `definitionFile` is set. If the build org lacks a feature the
  UIBundle needs, `version create` fails; record it and add a `definitionFile` (C-SMF5-5).
