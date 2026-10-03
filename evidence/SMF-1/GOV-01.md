# GOV-01 — fresh agent session — official and project skills discoverable without machine-global dependencies

| Field | Value |
|---|---|
| Case ID | GOV-01 |
| Story | SMF-1 |
| Persona pair | Implementing agent (no Salesforce persona; SMF-1 needs no org) |
| Fixture IDs / hash / version | n/a — skills pinned to forcedotcom/afv-library `3c15867b` (1.59.0); per-skill hashes in `docs/provenance/official-skills.json` |
| Build / commit | `cb21b8c` (first SMF-1 commit) |
| Host / device / OS / app / browser | Linux cloud container; Claude Code 2.1.288; Python 3; Node 22 |
| Environment row | n/a — repository/agent check |
| Timestamp | 2026-10-03T18:42:27Z |
| Preconditions | Fresh `git clone` of the commit into an empty directory; `HOME` set to an empty directory so no user-level (`~/.claude/skills`) skills, settings, or memory load; `--setting-sources project` |
| Steps | 1. Follow README/AGENTS.md (no install step needed). 2. `claude -p --setting-sources project "List the names of every skill available to you…"`. 3. `python3 scripts/verify-skills.py`. 4. Negative checks: append a byte to an official SKILL.md; delete one `.claude/skills` link. |
| Expected result | "In a fresh contributor session, follow repo instructions; verify official/project skills can be discovered and loaded without undocumented machine-global dependencies." |
| Actual result | Step 2 listed all 35 repository skills — 28 official + 7 `smf-*`: design-systems-slds-apply dx-code-analyzer-run dx-org-analyze dx-org-devhub-configure dx-org-manage dx-org-permission-set-assign dx-org-switch dx-org-trial-expiration-check experience-ui-bundle-2gp-deploy experience-ui-bundle-app-coordinate experience-ui-bundle-custom-app-generate experience-ui-bundle-deploy experience-ui-bundle-file-upload-generate experience-ui-bundle-frontend-generate experience-ui-bundle-metadata-generate experience-ui-bundle-project-generate experience-ui-bundle-salesforce-data-access platform-apex-generate platform-apex-test-generate platform-apex-test-run platform-data-manage platform-docs-get platform-metadata-deploy platform-metadata-retrieve platform-permission-set-generate platform-sharing-owd-configure platform-sharing-rules-generate platform-soql-query smf-capability-probe smf-evidence smf-physical-mobile-testing smf-public-provenance smf-review smf-salesforce-boundaries smf-story-workflow — plus only Claude Code's bundled built-ins (dataviz artifact-design artifact-diagramming artifact-capabilities update-config keybindings-help code-review simplify fewer-permission-prompts loop claude-api workflow-authoring run plugin-authoring init security-review ), which ship with the CLI. Step 3: `OK: 28 official skills (pinned 3c15867bdb9d, content verified) + 7 project skills discoverable`. Step 4: each tamper produced FAIL naming the skill; restored. In GOV-02 the same isolated agent opened 10 selected SKILL.md files through `.agents/skills/`. At install time every official folder was byte-identical (`diff -r`) to a clone of the pinned revision. |
| Outcome | PASS |
| Evidence link | this record; `docs/dry-runs/SMF-2-plan.md` §1/§3; `scripts/verify-skills.py` |
| Tester | Implementing agent (Claude Code cloud session). Review: Brandon (pending) |
| Limitation / follow-up | Verified with Claude Code only. Codex reads `.agents/skills/` per the Agent Skills spec but was not run here. On Windows, `.claude/skills` symlinks need `core.symlinks=true` (documented in provenance). Network is needed only to *upgrade* skills, not to use them. |
