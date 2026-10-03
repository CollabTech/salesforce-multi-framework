# Official Salesforce skills — provenance

| Field | Value |
|---|---|
| Upstream | https://github.com/forcedotcom/afv-library (README install alias `forcedotcom/sf-skills`, same HEAD) |
| Publisher | Salesforce, Inc. (`forcedotcom` GitHub org; npm `@salesforce/afv-skills` by `salesforce-releases`) |
| Pinned revision | `3c15867bdb9dacd515960174c661c706d041bb63` — "chore(release): 1.59.0", 2026-10-03T00:18:43Z |
| Licence | `LICENSE.txt` in the repo: Apache-2.0. **Conflict:** `package.json` / npm metadata say CC-BY-NC-4.0 — see `docs/contradictions.md` C-02 |
| Mechanism | Upstream-documented `npx skills add` (vercel-labs `skills` CLI, pinned `skills@1.7.0`), project scope, agents `claude-code` + `codex` |
| Installed | 2026-10-03 by `scripts/install-official-skills.sh` |
| Verification | `python3 scripts/verify-skills.py` — pinned ref per `skills-lock.json`, per-skill content hash in `official-skills.json`; at install time every folder was also byte-compared (`diff -r`) with a clone of the pinned revision: identical |

## How contributors load them

Nothing to install for normal work — the skills are committed.

- **Claude Code**: discovers `.claude/skills/*/SKILL.md` (symlinks into `.agents/skills/`)
  automatically when started in the repo root; `CLAUDE.md` imports `AGENTS.md`.
  On Windows, enable git symlinks (`git config core.symlinks true`, Developer Mode) or
  rerun the installer.
- **Codex / other Agent Skills tools**: read `.agents/skills/` and `AGENTS.md`.
- **Agentforce Vibes**: auto-installs its own copy of the same library; still follow
  `AGENTS.md` and the `smf-*` skills.
- **Upgrade**: edit `REVISION` in `scripts/install-official-skills.sh`, run it, then
  `python3 scripts/verify-skills.py --write-hashes`, update this file, and open a PR.
  Never edit official skill files in place, and never install with `-g`.

## Selected skills (28 of 241)

| Skill | Why it is in scope |
|---|---|
| `experience-ui-bundle-app-coordinate` | Entry point for building the React UIBundle app (SMF-4+). |
| `experience-ui-bundle-project-generate` | Generates the official `reactinternalapp` scaffold (ADR-0002, SMF-4). |
| `experience-ui-bundle-metadata-generate` | UIBundle metadata/config and required `uiBundles/` location. |
| `experience-ui-bundle-frontend-generate` | Required before editing UI under `uiBundles/*/src/`. |
| `experience-ui-bundle-salesforce-data-access` | Reading/writing case and asset data from the bundle. |
| `experience-ui-bundle-file-upload-generate` | Salesforce Files (ContentVersion) upload for SMF-10/11. |
| `experience-ui-bundle-custom-app-generate` | Surfacing the bundle as an internal Lightning app (SMF-4). |
| `experience-ui-bundle-deploy` | Deploy + post-deploy setup of the bundle (SMF-4). |
| `experience-ui-bundle-2gp-deploy` | Unlocked 2GP create/install/upgrade of a UI bundle (SMF-5, SMF-16). |
| `dx-org-devhub-configure` | Dev Hub enablement and scratch-org allocation (SMF-2 ENV-01/02). |
| `dx-org-manage` | Scratch/test org create, display, open (SMF-2 ENV-03). |
| `dx-org-switch` | Explicit org targeting / alias management. |
| `dx-org-analyze` | Org inventory: edition, licences, limits, installed packages (SMF-2 ENV-01/02). |
| `dx-org-permission-set-assign` | Assigning persona permission sets (SMF-3 DATA-02/03). |
| `dx-org-trial-expiration-check` | Detecting expiring dev/test orgs that would block runs. |
| `platform-permission-set-generate` | Persona permission-set metadata (SMF-3). |
| `platform-sharing-owd-configure` | Org-wide defaults for the MF-RESTRICTED / MF-CASE-002 denial baseline. |
| `platform-sharing-rules-generate` | Sharing rules for case access by persona. |
| `platform-data-manage` | Idempotent synthetic fixture seed/cleanup (SMF-3 DATA-01/04). |
| `platform-soql-query` | Verification queries for counts and access checks. |
| `platform-metadata-deploy` | sf CLI deploys and CI. |
| `platform-metadata-retrieve` | Retrieving org metadata to verify baseline settings. |
| `platform-docs-get` | Retrieving current official Salesforce documentation (platform requirements). |
| `platform-apex-generate` | Server-side authorization/token boundary for media and markup rooms. |
| `platform-apex-test-generate` | Apex tests for that boundary, including denial paths. |
| `platform-apex-test-run` | Running Apex tests and coverage for packaging. |
| `dx-code-analyzer-run` | Security/quality scanning during review. |
| `design-systems-slds-apply` | SLDS styling so the bundle fits Lightning hosts. |

## Deliberately not installed

- `mobile-apps-create`, `mobile-platform-*` — native Mobile SDK apps and LWC device APIs;
  this PoC hosts a React UIBundle in the Salesforce mobile app instead. Revisit if SMF-4/6
  evidence forces an LWC or native path (record an ADR first).
- `experience-ui-bundle-site-generate`, `-features-generate`, `-mfa-configure`,
  `experience-lwr-*`, `experience-portal-*` — external/Experience-site hosting; this is an
  internal app.
- Agentforce, Commerce, Data 360, Education, Field Service, Life Sciences, OmniStudio,
  Service/ITSM, Sales skills — unrelated to the backlog.
- `experience-ui-bundle-project-generate` mentions a `dx-project-create` skill "in the
  salesforce-development plugin"; it is not part of afv-library at this revision and is not
  assumed to exist.
