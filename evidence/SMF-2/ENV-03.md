# ENV-03 — n/a — org/CLI readiness — separate dev and install-test targets and repeatable setup path

| Field | Value |
|---|---|
| Case ID | ENV-03 |
| Story | SMF-2 |
| Persona pair | MF-ADMIN |
| Fixture IDs / hash / version | n/a |
| Build / commit | b79111a |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14 |
| Environment row | n/a — org/CLI readiness |
| Timestamp | 2026-10-03T21:34:20Z |
| Preconditions | ENV-01/02 |
| Steps | 1. Document three targets (smf-devhub, smf-dev, smf-install-test) and their create/reuse steps: docs/smf-2/setup-path.md, config/smf-*-scratch-def.json 2. readiness.py compares org IDs privately and refuses dev == install-test |
| Expected result | Document separate dev/install-test targets and the repeatable setup path. Report each readiness item as observed PASS/BLOCKED; do not claim a package has been tested. |
| Actual result | Documented: three distinct aliases; Dev Hub excluded as an application test org; scratch definitions for dev and install-test; ordered setup commands, each with an explicit target; the script rejects identical dev/install-test aliases. Observed: no target exists or is reachable from this environment, so separation could not be observed (distinct=False, unknown). No package was created or tested. |
| Outcome | BLOCKED |
| Evidence link | docs/smf-2/setup-path.md; evidence/SMF-2/readiness-2026-10-03.md |
| Tester | Implementing agent |
| Limitation / follow-up | The documentation half is done; the observation half needs the two scratch orgs (setup-path step 4, consumes 2 of 3 active scratch orgs on a Developer-Edition Dev Hub) after ENV-01 is unblocked. |
