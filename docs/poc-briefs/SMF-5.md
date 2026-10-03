# POC-05 brief — Prove unlocked 2GP creation, clean installation, and a minimal upgrade (SMF-5)

- **Story:** [SMF-5](https://answersllc.atlassian.net/browse/SMF-5) · **Dependencies:** SMF-4 (and, through the story's test data, the SMF-3 baseline in the install-test org; orgs from SMF-2)
- **Case IDs:** PKG-01, PKG-02, PKG-03 (`testing/test-plan-index.json`)
- **Status:** TESTING (implementation in; cloud stages 60–64 ready; evidence BLOCKED) · **Capability outcome:** BLOCKED
- **Selected skills:** project `smf-story-workflow`, `smf-evidence`, `smf-capability-probe`, `smf-salesforce-boundaries`, `smf-public-provenance`; official `experience-ui-bundle-2gp-deploy` (mechanics), `experience-ui-bundle-frontend-generate` (marker page), `dx-org-permission-set-assign` (runbook assignment step)
- **Source:** Jira snapshot `docs/jira-snapshot/2026-10-03/SMF-5.md` (identical to live Jira on 2026-10-03)

## Question this probe answers
Can the FieldSupport UIBundle, with its internal-app and access metadata, be distributed as
an unlocked 2GP package, installed cleanly into a separate org where a non-admin launches
it, and upgraded to a small follow-up version without losing user data?

## Bounded scope
In scope: package definition in `sfdx-project.json`; the packaged/unpackaged split; a
one-constant visible v1→v2 change (`src/probes/smf-05-version/`, route
`/probes/package-version`); offline checks; operator runbook
(`docs/smf-5/subscriber-runbook.md`); human script (`docs/test-scripts/SMF-5-PKG.md`);
sanitizing and state-comparison helpers (`scripts/smf5/`).
Out of scope: packaging other probes' server metadata or external services (SMF-16),
host/mobile matrix (SMF-4 HOST-03), provisioning personas/fixtures (SMF-3).

## Design
- Unlocked, org-dependent, no namespace (skill flavour table); package `FieldSupportPoC` =
  `force-app` = exactly `UIBundle:FieldSupport`, `CustomApplication:FieldSupport`,
  `PermissionSet:FieldSupport_Access`. Test fixtures live in the non-packaged `unpackaged/`.
- v1 `1.0.0.NEXT`, v2 `1.1.0.NEXT`; no ancestors (managed-only concept); validated builds
  with `--code-coverage`; no installation key; install `--security-type AdminsOnly` with
  access via `FieldSupport_Access` assignments.
- IDs and raw CLI JSON private (`private/packages.json`, `private/smf5/`); published reports
  pass through `scripts/smf5/sanitize_report.py`; `scan-public-content.py` now flags
  `0Ho/04t/05i/08c/0Hf/06y` IDs.

## Test plan per case ID
| Case ID | Personas | Fixtures | Environment rows | Steps (summary) | Expected | Stop conditions |
|---|---|---|---|---|---|---|
| PKG-01 | MF-ADMIN installs; MF-TECH, MF-SUPPORT launch (install-test org) | MF-CASE-001 baseline seeded by SMF-3 tooling | ENV-DESKTOP-EDGE + ENV-CLOUD-CHROMIUM (cloud, agent); ENV-DESKTOP-CHROME if installable | Stages 60–63 | Create/install unlocked v1, assign intended access, and verify a non-admin can launch the installed app. | 2GP gate off; version create Error; install not listed; any persona result missing |
| PKG-02 | MF-ADMIN upgrades; MF-TECH, MF-SUPPORT verify | MF-CASE-001, MF-IMAGE-001 | ENV-DESKTOP-EDGE + ENV-CLOUD-CHROMIUM (cloud, agent) | Stage 64 (snapshot, v2, upgrade, compare, persona queries, spec) | Install v2 over v1, verify activation/version behavior, and confirm the seeded case/file state is preserved. | Upgrade refused (record, then owner decision on promote) |
| PKG-03 | MF-ADMIN removes/restores; MF-RESTRICTED | baseline grants | ENV-DESKTOP-EDGE + ENV-CLOUD-CHROMIUM (cloud, agent) | Stage 63 spec; sanitized reports from stages 60/61/64 | Repeat the app permission-denial scenario in the install-test org. Capture package operation reports and limitations without auth material. | Baseline not restorable |

## Prerequisites and blockers
| Case | Gap | Smallest unblocking action |
|---|---|---|
| PKG-01..03 | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied | Owner: `docs/cloud/HUMAN-SETUP.md` H1 (egress) and H2 (`SF_AUTH_URL_DEVHUB`); then the agent runs stages 10/20 |
| PKG-01..03 | Dev Hub `smf-devhub` with "Enable Unlocked Packages and Second-Generation Managed Packages" on, authenticated; ≥ 2 `Package2VersionCreates` remaining | Owner consent H3 (`SMF_DEVHUB_ENABLE_OK=yes`); if the toggle is still off, Brandon: Setup → Dev Hub → enable it (no CLI equivalent) |
| PKG-01..03 | `smf-install-test` scratch org, with Multi-Framework app domain and Edge Network observed | Agent: stage 20 creates it; Multi-Framework domain / Edge Network per SMF-2 |
| PKG-01..03 | SMF-3 personas and MF-CASE-001/MF-IMAGE-001 baseline in the install-test org, with DATA evidence | Agent: stage 62 (runs SMF-3 stages against smf-install-test) |
| PKG-01..03 | SMF-3 provisioning honouring `SMF_TARGET_ORG=smf-install-test` (C-SMF5-6) | SMF-3 stage interface; then stage 62 |
| PKG-02 | Upgrade of an unpromoted v1 may be refused (C-SMF5-2) | Owner sets `SMF_PKG_PROMOTE_OK=yes` only if promoting v1 is approved |
| supplementary | Physical Salesforce mobile launch of the installed app | Device tester: `docs/test-scripts/SMF-5-PKG.md` (HUMAN-ACTIONS rows) |

Open questions are logged as C-SMF5-1..6 in `docs/contradictions.md`. Licensing/cost: no
paid service; package version creates count against the Dev Hub's daily limit.

## Results
All three cases BLOCKED (`evidence/SMF-5/PKG-01.md`, `PKG-02.md`, `PKG-03.md`). Offline
checks pass (`check_package.py --built`, unit tests, bundle lint/test/build, offline v2 build
through `pkgflow.py`, cloud-e2e spec typecheck/listing); these are
supporting evidence, not PASS.
