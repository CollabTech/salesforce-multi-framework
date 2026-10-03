# PKG-01 — ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM recorded as a separate row; ENV-DESKTOP-CHROME if branded Chrome is installable) — not run — unlocked v1 create/install, access, non-admin launch — not executed

| Field | Value |
|---|---|
| Case ID | PKG-01 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (create/install, install-test org); MF-TECH and MF-SUPPORT (launch, own sessions in the install-test org) — logical IDs; none exist in any org yet |
| Fixture IDs / hash / version | MF-CASE-001 baseline in the install-test org (SMF-3 stages via stage 62) — not seeded; package FieldSupportPoC v1 (versionNumber 1.0.0.NEXT, tag smf5-v1-<sha>) — not built |
| Build / commit | Branch claude/smf-5-packaging @ b43b29f (package definition, v1 marker, stages 60-64); package version: none created |
| Host / device / OS / app / browser | None executed. Offline only: Linux cloud container, Salesforce CLI 2.152.14, Node v22.22.0 |
| Environment row | ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM recorded as a separate row; ENV-DESKTOP-CHROME if branded Chrome is installable) — not run |
| Timestamp | 2026-10-03T22:35:00Z |
| Preconditions | Required: owner setup H1 (egress), H2 (SF_AUTH_URL_DEVHUB), H3 (Dev Hub/unlocked packaging consent); SMF-2 stages 10/20 (smf-devhub, smf-install-test); SMF-3 stages honouring SMF_TARGET_ORG=smf-install-test (C-SMF5-6). Actual: SMF-2 ENV-01..03 BLOCKED (no org credential; egress to Salesforce denied); SMF-3 not verified in any org. |
| Steps | 1. bash scripts/cloud/pipeline.sh 60 61 62 63 (stage 60: check_package + pkgflow version v1; 61: install v1; 62: SMF-3 provisioning against smf-install-test + FieldSupport_Access; 63: testing/cloud-e2e/tests/smf-5-package.spec.ts PKG-01 as MF-TECH and MF-SUPPORT) |
| Expected result | Create/install unlocked v1, assign intended access, and verify a non-admin can launch the installed app. |
| Actual result | Not executed: no Dev Hub or subscriber org is reachable from this environment. Offline runs of the stages: 60 -> BLOCKED 'Dev Hub alias smf-devhub not authenticated'; 62 -> BLOCKED 'SMF-3 provisioning stages (30-39) not present'. Offline supporting checks only (not a result): package directory force-app = exactly CustomApplication:FieldSupport, PermissionSet:FieldSupport_Access, UIBundle:FieldSupport; payload 87 bundle files incl. dist/ (3), 2241 KiB, no node_modules; bundle lint 0 errors, vitest 5/5, build OK; spec typechecks (tsc --strict) and lists 6 tests (PKG-01 x2, PKG-03) per row. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-5/offline-checks-2026-10-03.md (supporting only); docs/smf-5/subscriber-runbook.md |
| Tester | Implementing agent (Claude Code cloud session) — offline checks only |
| Limitation / follow-up | Unblock: (1) owner H1+H2+H3 (docs/cloud/HUMAN-SETUP.md); (2) agent: pipeline stages 10, 20 (smf-install-test), SMF-3 30-39, then 60-63. If the Dev Hub toggle 'Enable Unlocked Packages and Second-Generation Managed Packages' is still off after H3, Brandon flips it in Setup (no CLI equivalent). Open risks: C-SMF5-1 (org-dependent flavour in a scratch subscriber), C-SMF5-5 (build details), C-SMF5-6 (SMF-3 interface). Physical Salesforce mobile launch is supplementary and human-only (HUMAN-ACTIONS rows). |
