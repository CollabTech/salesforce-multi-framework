# PKG-02 — ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM separate row) — not run — v1 → v2 upgrade, version/activation behaviour, seeded state preserved — not executed

| Field | Value |
|---|---|
| Case ID | PKG-02 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (upgrade, state snapshots); MF-TECH and MF-SUPPORT (own-session record queries and browser checks) — logical IDs |
| Fixture IDs / hash / version | MF-CASE-001, MF-IMAGE-001 in the install-test org — not seeded; package v2 = same commit + PACKAGE_MARKER v2 (1.1.0), versionNumber 1.1.0.NEXT (scripts/smf5/set_version.py v2, tag smf5-v2-<sha>) — not built in an org |
| Build / commit | Branch claude/smf-5-packaging @ b43b29f |
| Host / device / OS / app / browser | None executed |
| Environment row | ENV-DESKTOP-EDGE (cloud, agent-run; ENV-CLOUD-CHROMIUM separate row) — not run |
| Timestamp | 2026-10-03T22:35:00Z |
| Preconditions | PKG-01 executed with v1 installed in smf-install-test. Actual: PKG-01 BLOCKED. |
| Steps | 1. bash scripts/cloud/pipeline.sh 64 (state before-v2; version v2; install v2 --upgrade-type Mixed; state after-v2; verify-state: snapshot compare, FieldSupport_Access count, MF-TECH/MF-SUPPORT own queries of MF-CASE-001 and its Files; spec PKG-02 marker v2 as both personas) |
| Expected result | Install v2 over v1, verify activation/version behavior, and confirm the seeded case/file state is preserved. |
| Actual result | Not executed (no org). Offline only: pkgflow build path for v2 run end to end in a throw-away worktree (npm ci, lint, vitest, build, check_package --built): marker { label: 'v2', number: '1.1.0' }, versionNumber 1.1.0.NEXT, build id <sha>+v2 and label v2 embedded in dist; set_version round-trip and state compare logic unit-tested. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-5/offline-checks-2026-10-03.md (supporting only); scripts/smf5/pkgflow.py; scripts/smf5/state_snapshot.py |
| Tester | Implementing agent — offline checks only |
| Limitation / follow-up | Unblock: PKG-01 unblocking actions, then stage 64. Whether an unpromoted unlocked v1 can be upgraded is unconfirmed (C-SMF5-2): a refusal is recorded as a run and stage 64 exits BLOCKED; promoting v1 (irreversible) only with the owner's consent SMF_PKG_PROMOTE_OK=yes. |
