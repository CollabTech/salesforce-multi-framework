# One-time human setup for the cloud workflow

Everything else — org creation, provisioning, deploy, packaging, browser automation,
evidence and the matrix — runs in the Claude Code cloud environment (`docs/cloud/WORKFLOW.md`).
These steps need the project owner because they involve account ownership, a passkey, or
environment settings an agent cannot change. Secrets go **only** into the environment's
settings, never into chat, Jira, or Git. A new cloud session picks up changes.

| # | Who | Where | Action | Unblocks |
|---|---|---|---|---|
| H1 | Brandon | Claude Code → session title bar → environment menu → **Edit → Network access** | Choose **Custom**, keep the default package-manager list, and add the domains below | every org/Cloudflare case |
| H2 | Brandon | A machine with the Salesforce CLI (`npm i -g @salesforce/cli`) | `sf org login web --alias smf-devhub --instance-url https://login.salesforce.com` (complete the passkey), then `sf org display --verbose --json --target-org smf-devhub` and copy `result.sfdxAuthUrl` into the environment variable **`SF_AUTH_URL_DEVHUB`** (Edit → Environment variables). Delete the local auth afterwards if wanted (`sf org logout --target-org smf-devhub`). | ENV-01..03 and everything after |
| H3 | Brandon | Same environment settings | Confirm in the variable **`SMF_DEVHUB_ENABLE_OK=yes`** that the agent may enable Dev Hub and unlocked packaging if they are off (irreversible on that org) | ENV-01, PKG-* |
| H4 | Brandon | dash.cloudflare.com | Create an API token scoped to the project account with **Realtime: Edit** (RealtimeKit apps, meetings, participants) and **Workers Scripts: Edit** + **Workers R2 Storage: Edit** (markup sync service). Set **`CF_ACCOUNT_ID`** and **`CF_API_TOKEN`** | CALL-*, SHARE-*, REC-*, SYNC-* |
| H5 | Brandon | tldraw.dev → license (trial or commercial) | Set **`TLDRAW_LICENSE_KEY`** (needed because the app is served over HTTPS from a Salesforce domain = tldraw "production") | MARK-*, SYNC-* host rows |
| H7 | Brandon | Review ADR-0004 | **Approve or reject** the encrypted org-session vault (stores agent-created scratch-org/persona auth URLs, encrypted, as a private File in the Dev Hub). Until approved, `vault.py save` is not run: orgs and personas created in a session last only for that session, and a new session recreates them (2 of the 6 daily Developer-Edition scratch orgs) | cross-session continuity |
| H8 | Brandon | Salesforce Setup (smf-dev) after the agent deploys SMF-7 / SMF-12 | Enter the Cloudflare API token into the SMF-7 External Credential principal and the markup room-token signing secret into the SMF-12 credential, as named in `docs/smf-7`/`docs/smf-12` handoffs. Secrets are never written by scripts | CALL-*, SYNC-* |
| H6 | Brandon | Same environment settings | Set **`SMF_TESTER_EMAIL`** to the mailbox that should receive persona verification/password-reset email for device logins (only stored on the synthetic persona users in the scratch org) | device rows of all stories |

## H1 domain list

```
login.salesforce.com
test.salesforce.com
*.salesforce.com
*.force.com
*.my.salesforce.app
*.salesforce.app
*.sfdcstatic.com
*.salesforce-setup.com
*.documentforce.com
*.visualforce.com
developer.salesforce.com
help.salesforce.com
api.cloudflare.com
*.realtime.cloudflare.com
*.workers.dev
dl.google.com
```

`dl.google.com` lets the agent install branded **Google Chrome** for the ENV-DESKTOP-CHROME row;
without it, only Playwright **Chromium** (a separate, non-substitute row) is available.
Microsoft Edge already installs from `packages.microsoft.com` (allowed by default).
The SMF-7/SMF-12 handoffs list any additional RealtimeKit or tldraw hosts if the SDKs need them.

## What the agent does after H1–H2 (no further human steps)

1. `bash scripts/cloud/session-setup.sh` (first command of each cloud session): sf CLI, skills,
   Microsoft Edge, bundle deps, Dev Hub login from `SF_AUTH_URL_DEVHUB`, restore of the
   dev/install-test/persona sessions from the encrypted vault in the Dev Hub (ADR-0004).
2. `scripts/cloud/pipeline.sh all`: readiness (ENV-*), scratch orgs, SMF-3 provisioning and
   access checks, SMF-4 deploy, cloud browser tests, packaging, matrix and evidence update.
