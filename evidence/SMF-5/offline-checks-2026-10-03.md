# SMF-5 offline checks — 2026-10-03 (supporting evidence, not a PKG result)

Commit 64bc02a on `claude/smf-5-packaging`; Linux cloud container; Salesforce CLI 2.152.14;
Node v22.22.0. No org was contacted (none is reachable: SMF-2 ENV-01..03 BLOCKED).

| Check | Command | Result |
|---|---|---|
| Project file parses; package directory members | `python3 scripts/smf5/check_package.py --built` (runs `sf project generate manifest` and `sf project convert source` on `force-app`) | OK. Members: `CustomApplication:FieldSupport`, `PermissionSet:FieldSupport_Access`, `UIBundle:FieldSupport`. Payload: 87 bundle files (3 in `dist/`), 2241 KiB; no `node_modules`; `__tests__` excluded by `.forceignore` |
| Non-packaged directory resolves | `sf project generate manifest --source-dir unpackaged` | OK (empty) |
| v2 definition | `scripts/smf5/set_version.py v2` → `check_package.py` → `set_version.py v1` | OK; v1 restored byte-for-byte (`git diff` empty) |
| Bundle | `npm run lint` / `npx vitest run` / `npm run build` | 0 errors (1 pre-existing warning in `src/types/globals.d.ts`) / 5 of 5 tests, 2 files / built |
| UI rules | `verify-rules.mjs src/probes/smf-05-version` (experience-ui-bundle-frontend-generate) | No hard-rule violations |
| Static analysis | `sf code-analyzer run --workspace src/probes/smf-05-version --rule-selector Recommended` | 0 violations (regex, eslint, cpd) |
| Helper scripts | `python3 -m unittest discover -s scripts/tests` | 27 tests OK (SMF-5: project definition, members, v1/v2 switch, state compare, report sanitizer) |
| Repo checks | `verify-skills.py`, `check-test-plan.py`, `scan-public-content.py` | see commit for this file |

Not possible here: `sf package create`, `sf package version create`, `sf package install`,
`sf project deploy validate` and any persona launch — they need an authenticated Dev Hub and
subscriber org.
