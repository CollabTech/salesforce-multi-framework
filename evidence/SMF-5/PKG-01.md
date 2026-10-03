# PKG-01 — ENV-DESKTOP-CHROME (declared row for PKG cases) — not run — unlocked v1 create/install, access, non-admin launch — not executed

| Field | Value |
|---|---|
| Case ID | PKG-01 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (create/install, install-test org); MF-TECH and MF-SUPPORT (launch) — logical IDs; none exist in any org yet |
| Fixture IDs / hash / version | MF-CASE-001 baseline in the install-test org (SMF-3 tooling) — not seeded; package FieldSupportPoC v1 (versionNumber 1.0.0.NEXT) — not built |
| Build / commit | Branch claude/smf-5-packaging @ 64bc02a (package definition + v1 marker); package version: none created |
| Host / device / OS / app / browser | None executed. Offline only: Linux cloud container, Salesforce CLI 2.152.14, Node v22.22.0 |
| Environment row | ENV-DESKTOP-CHROME (declared row for PKG cases) — not run |
| Timestamp | 2026-10-03T22:07:51Z |
| Preconditions | Required: SMF-2 ENV-01..03 observed; smf-devhub with unlocked 2GP enabled; smf-install-test scratch org; SMF-3 personas and baseline in that org; SMF-4 app buildable. Actual: SMF-2 ENV-01..03 BLOCKED (no org credential; egress to Salesforce denied); SMF-3 not verified in any org. |
| Steps | 1. docs/smf-5/subscriber-runbook.md steps 0-8 2. docs/test-scripts/SMF-5-PKG.md § PKG-01 (Brandon, Chrome) |
| Expected result | Create/install unlocked v1, assign intended access, and verify a non-admin can launch the installed app. |
| Actual result | Not executed: no Dev Hub or subscriber org is reachable from this environment, so no package, version, install or persona launch exists. Offline supporting checks only (not a result): sfdx-project.json parses (sf project generate manifest / convert source succeed); package directory force-app contains exactly CustomApplication:FieldSupport, PermissionSet:FieldSupport_Access, UIBundle:FieldSupport; payload 87 bundle files incl. dist/ (3 files), ~2.2 MiB, no node_modules; bundle lint 0 errors, vitest 5/5 (2 files), build OK; python unit tests pass. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-5/subscriber-runbook.md; docs/poc-briefs/SMF-5.md; evidence/SMF-5/offline-checks-2026-10-03.md (supporting only) |
| Tester | Implementing agent (Claude Code cloud session) — offline checks only; no human step run |
| Limitation / follow-up | Unblock in order: (1) SMF-2: allow egress to Salesforce hosts and provide the Dev Hub auth URL (secret env var) or run on a contributor machine; authenticate smf-devhub. (2) Brandon: Setup → Dev Hub → enable 'Unlocked Packages and Second-Generation Managed Packages'. (3) Create smf-install-test (sf org create scratch --definition-file config/smf-install-test-scratch-def.json --alias smf-install-test --target-dev-hub smf-devhub --duration-days 30) and record SMF-2 setup-path step 5 observations for it. (4) Run SMF-3 tooling with --target-org smf-install-test and record its DATA evidence there. (5) Operator: runbook steps 0-7. (6) Brandon: docs/test-scripts/SMF-5-PKG.md § PKG-01 as MF-TECH and MF-SUPPORT in Chrome. Open risks: C-SMF5-1 (org-dependent flavour in a scratch subscriber), C-SMF5-5 (build details). |
