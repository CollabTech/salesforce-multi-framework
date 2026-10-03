# SMF-5 offline checks — 2026-10-03 (supporting evidence, not a PKG result)

Commits 64bc02a–b43b29f on `claude/smf-5-packaging`; Linux cloud container; Salesforce CLI 2.152.14;
Node v22.22.0. No org was contacted (none is reachable: SMF-2 ENV-01..03 BLOCKED).

| Check | Command | Result |
|---|---|---|
| Project file parses; package directory members | `python3 scripts/smf5/check_package.py --built` (runs `sf project generate manifest` and `sf project convert source` on `force-app`) | OK. Members: `CustomApplication:FieldSupport`, `PermissionSet:FieldSupport_Access`, `UIBundle:FieldSupport`. Payload: 87 bundle files (3 in `dist/`), 2241 KiB; no `node_modules`; `__tests__` excluded by `.forceignore` |
| Non-packaged directory resolves | `sf project generate manifest --source-dir unpackaged` | OK (empty) |
| v2 definition | `scripts/smf5/set_version.py v2` → `check_package.py` → `set_version.py v1` | OK; v1 restored byte-for-byte (`git diff` empty) |
| Bundle | `npm run lint` / `npx vitest run` / `npm run build` | 0 errors (1 pre-existing warning in `src/types/globals.d.ts`) / 5 of 5 tests, 2 files / built |
| UI rules | `verify-rules.mjs src/probes/smf-05-version` (experience-ui-bundle-frontend-generate) | No hard-rule violations |
| Static analysis | `sf code-analyzer run --workspace src/probes/smf-05-version --rule-selector Recommended` | 0 violations (regex, eslint, cpd) |
| Helper scripts | `python3 -m unittest discover -s scripts/tests` | 31 tests OK (SMF-5: project definition, members, v1/v2 switch, state compare, report sanitizer, pkgflow helpers, stage headers) |
| v2 build path (cloud flow) | `pkgflow.build_tree('v2')` at b43b29f: throw-away worktree, `set_version.py v2`, `npm ci`, lint, vitest, build, `check_package.py --built` | OK: marker `{ label: 'v2', number: '1.1.0' }`, versionNumber `1.1.0.NEXT`, build id `<sha>+v2` and label in `dist/` |
| Stages offline | `pkgflow.py version v1`; `pkgflow.py access`; `62-smf5-subscriber-personas.sh` | exit 2 BLOCKED: "Dev Hub alias smf-devhub not authenticated"; "subscriber persona aliases missing"; "SMF-3 provisioning stages (30-39) not present" |
| Cloud-e2e spec | framework from `claude/smf-2-readiness` copied to a temp dir; `tsc --noEmit --strict`; `playwright test --list` | typechecks; v1 phase lists PKG-01 tech/support + PKG-03 per row (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM), v2 phase PKG-02 tech/support per row |
| Repo checks | `verify-skills.py`, `check-test-plan.py`, `scan-public-content.py`, `unittest` | all OK (31 tests) |

Not possible here: `sf package create`, `sf package version create`, `sf package install`,
`sf project deploy validate` and any persona launch — they need an authenticated Dev Hub and
subscriber org.
