# GOV-01 — n/a — repository/agent check — on-demand official skills, deterministic integrity, Claude skill entries (run 3, after review)

| Field | Value |
|---|---|
| Case ID | GOV-01 |
| Story | SMF-1 |
| Persona pair | Implementing agent (no Salesforce persona) |
| Fixture IDs / hash / version | Official skills: forcedotcom/afv-library 3c15867b (1.59.0), 28 skills / 425 files, per-file upstream Git blob IDs in docs/provenance/official-skills.json |
| Build / commit | b79111a (clones A and B/C/D); section E clone 1f9542d = b79111a + SMF-2 docs only |
| Host / device / OS / app / browser | Linux cloud container; Python 3.11; Node v22.22.0; Claude Code 2.1.288; skills CLI skills@1.7.0 |
| Environment row | n/a — repository/agent check |
| Timestamp | 2026-10-03T21:34Z–21:44Z |
| Preconditions | Fresh git clone, HOME set to an empty directory; official skills not tracked; network to github.com and registry.npmjs.org only |
| Steps | 1. verify-skills.py before bootstrap 2. bootstrap-skills.py (npx skills@1.7.0 add … --agent codex per skill, then .claude/skills links, then verify) 3. git status after bootstrap 4. check-test-plan.py, scan-public-content.py, unittest (11 tests) 5. Integrity negatives: append a byte; add extra.md; delete README.md; convert every text file to CRLF (expect OK); CRLF plus one changed byte 6. Link negatives: text-file placeholder; wrong target; dangling target; stale copy; identical copy (expect OK); stray entry; repair with bootstrap --offline 7. Clone with core.autocrlf=true; force CRLF on index/snapshot/evidence files; check-test-plan; bootstrap 8. claude -p (empty HOME, --setting-sources project) lists skills; reads smf-evidence and dx-org-switch |
| Expected result | In a fresh contributor session, follow repo instructions; verify official/project skills can be discovered and loaded without undocumented machine-global dependencies. (Review findings: deterministic across Windows/Linux line endings with real tamper detection; correct readable SKILL.md per Claude skill; placeholders and wrong targets rejected; vendor copies untracked.) |
| Actual result | 24 of 24 expectations met, 0 mismatches (log). Before bootstrap verify FAILs (not installed); bootstrap installs 28 skills and links 35 entries; 0 tracked changes afterwards (skills-lock.json byte-stable). All tamper cases FAIL naming the file; all-CRLF copy passes; CRLF+1 byte FAILs. Placeholder FAILs with 'text placeholder' message and is repaired by bootstrap --offline; wrong, dangling, stale-copy and stray entries FAIL; identical copy passes. autocrlf clone: 0 CRLF tracked files (.gitattributes); forced-CRLF index/snapshots still pass. Fresh Claude Code session listed all 35 repository skills plus only CLI built-ins and read SKILL.md of an official and a project skill. Windows junction/copy fallbacks verified only by unit tests with mocked os.symlink/mklink. |
| Outcome | PASS |
| Evidence link | evidence/SMF-1/logs/gov-portability-2026-10-03.txt; scripts/tests/gov-portability-run.sh; scripts/tests/test_portability.py |
| Tester | Implementing agent. Independent review: separate reviewer agent (see PR). Brandon: not performed |
| Limitation / follow-up | Windows/macOS: covered by `.github/workflows/repo-checks.yml` (GitHub-hosted runners: Linux, macOS, Windows symlink, Windows forced junction); the CI result for this commit is appended below once the run completes. The local unit test for the junction path is mocked. Earlier Linux results remain in GOV-01.md. Codex not exercised. |
