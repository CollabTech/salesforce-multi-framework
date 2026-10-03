# Official Salesforce skills — provenance

| Field | Value |
|---|---|
| Upstream | https://github.com/forcedotcom/afv-library (README install alias `forcedotcom/sf-skills`, same HEAD) |
| Publisher | Salesforce, Inc. (`forcedotcom` GitHub org; npm `@salesforce/afv-skills` by `salesforce-releases`) |
| Pinned revision | `3c15867bdb9dacd515960174c661c706d041bb63` — "chore(release): 1.59.0", 2026-10-03T00:18:43Z |
| Licence | `LICENSE.txt` in the repo: Apache-2.0. **Conflict:** `package.json` / npm metadata say CC-BY-NC-4.0 — see `docs/contradictions.md` C-02 |
| Mechanism | Upstream-documented `npx skills add` (vercel-labs `skills` CLI, pinned `skills@1.7.0`), project scope, agent `codex` (writes `.agents/skills/`), run on demand by `scripts/bootstrap-skills.py` |
| Tracked in Git | **No** (ADR-0001 rev 2; resolves C-02). Only `skills-lock.json` and this provenance are tracked. |
| Verification | `python3 scripts/verify-skills.py` — every installed file is checked against the upstream **Git blob ID** at the pinned revision recorded in `official-skills.json` (425 files; generated with `bootstrap-skills.py --record-manifest <clone>` from `git ls-tree`). LF/CRLF tolerant; any other change, extra or missing file fails. |

## How contributors load them

Run once per clone (and after a revision bump):

```sh
python3 scripts/bootstrap-skills.py      # Windows: py -3 scripts\bootstrap-skills.py
```

It installs any missing or failing official skill with the pinned CLI, restores
`skills-lock.json` byte-for-byte, creates `.claude/skills/<name>` for every skill, and runs
`verify-skills.py`. `--offline` only relinks and verifies.

- **Claude Code** discovers `.claude/skills/*/SKILL.md` when started in the repo root;
  `CLAUDE.md` imports `AGENTS.md`. Entries are relative symlinks; on Windows without
  symlink privilege (no Developer Mode/admin) the bootstrap makes a **directory junction**
  (`mklink /J`, no privilege needed), and only if that fails a **copy**. `verify-skills.py`
  rejects text-file symlink placeholders, wrong or dangling targets, and stale copies.
- **Windows bootstrap (documented, verified by unit tests only):** install Python 3.8+
  and Node 18+; `git clone`; `py -3 scripts\bootstrap-skills.py`. Line endings do not
  matter: `.gitattributes` keeps tracked text LF and the integrity check tolerates CRLF.
  Verified on GitHub-hosted Windows runners (symlink and forced-junction variants) by
  `.github/workflows/repo-checks.yml`; results in `evidence/SMF-1/GOV-01-portability.md`.
- **Codex / other Agent Skills tools** read `.agents/skills/` and `AGENTS.md`.
- **Agentforce Vibes** auto-installs its own copy of the same library; still follow
  `AGENTS.md` and the `smf-*` skills.
- **Upgrade:** change `revision` (and `installer_cli` if needed) in `official-skills.json`
  and the refs in `skills-lock.json`, run `bootstrap-skills.py --record-manifest <clone of
  upstream>` then `bootstrap-skills.py`, update this file, open a PR. Never edit official
  skill files in place, never install with `-g`.

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
