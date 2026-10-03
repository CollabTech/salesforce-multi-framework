# PKG-02 — ENV-DESKTOP-CHROME — not run — v1 → v2 upgrade, version/activation behaviour, seeded state preserved — not executed

| Field | Value |
|---|---|
| Case ID | PKG-02 |
| Story | SMF-5 |
| Persona pair | MF-ADMIN (upgrade); MF-TECH and MF-SUPPORT (verify) — logical IDs |
| Fixture IDs / hash / version | MF-CASE-001, MF-IMAGE-001 in the install-test org — not seeded; package v2 = v1 + PACKAGE_MARKER v2 (1.1.0), versionNumber 1.1.0.NEXT (scripts/smf5/set_version.py v2) — not built |
| Build / commit | Branch claude/smf-5-packaging @ 64bc02a (v1 definition; v2 is produced by set_version.py v2 + commit at run time) |
| Host / device / OS / app / browser | None executed |
| Environment row | ENV-DESKTOP-CHROME — not run |
| Timestamp | 2026-10-03T22:07:51Z |
| Preconditions | PKG-01 executed with v1 installed in smf-install-test. Actual: PKG-01 BLOCKED. |
| Steps | 1. docs/smf-5/subscriber-runbook.md steps 10-11 (state_snapshot before-v2, upgrade --upgrade-type Mixed, installed list, state_snapshot after-v2, compare, assignment counts) 2. docs/test-scripts/SMF-5-PKG.md § PKG-02 |
| Expected result | Install v2 over v1, verify activation/version behavior, and confirm the seeded case/file state is preserved. |
| Actual result | Not executed (no org). Offline only: set_version.py v2 changes exactly the marker line and the versionNumber/versionName/versionDescription, and v1 round-trips to the committed state (unit tests); check_package.py passes for the v2 definition; state_snapshot.py compare logic unit-tested (prints field names and fingerprints, never values). |
| Outcome | BLOCKED |
| Evidence link | docs/smf-5/subscriber-runbook.md; scripts/smf5/state_snapshot.py |
| Tester | Implementing agent — offline checks only |
| Limitation / follow-up | Unblock: PKG-01 unblocking actions, then runbook steps 10-11 and Brandon § PKG-02. Whether an unpromoted unlocked v1 can be upgraded is unconfirmed (C-SMF5-2): a refusal is recorded as a run; promoting v1 (irreversible) needs Brandon's recorded approval first. |
