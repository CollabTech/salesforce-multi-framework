# One-time human setup for the cloud workflow

Everything else (org creation and recovery, provisioning, deploy, secrets into Salesforce and
Cloudflare, browser automation, evidence, matrix) runs in the Claude Code cloud environment
(`docs/cloud/WORKFLOW.md`). Only the steps below need the project owner. They involve account
ownership, a passkey, or environment settings an agent cannot change.

Secrets go **only** into the environment's settings (session title bar → environment menu →
**Edit**), never into chat, Jira or Git. A new cloud session picks up changes.

| # | Where | Action | Interaction only you can do | Unblocks |
|---|---|---|---|---|
| H1 | Environment settings → **Network access** | Choose **Custom**, keep the default package-manager list, and add the domains below | Editing environment settings | Every org, Cloudflare and Chrome row |
| H2 | Dev Hub org UI, then environment settings | **Preferred: JWT.** Steps below. **Quick alternative:** `SF_AUTH_URL_DEVHUB` from `sf org display --verbose --json --target-org <devhub>` (field `sfdxAuthUrl`). Without JWT, scratch orgs and personas cannot be recovered in later sessions; they are reported BLOCKED, never recreated | Dev Hub login (passkey), creating the app, setting the variables | ENV-01..03 and everything after |
| H3 | Environment settings | `SMF_DEVHUB_ENABLE_OK=yes`, only if stage 20 reports the Dev Hub disabled. Enabling it is irreversible | Consent | ENV-01, PKG-* |
| H4 | dash.cloudflare.com, then environment settings | `CF_ACCOUNT_ID`; `CF_API_TOKEN` (Realtime: Edit, Workers Scripts: Edit; used by the agent to deploy); `CF_RTK_ORG_TOKEN` (**Realtime: Edit only**; the agent stores it in the scratch org's External Credential through the Connect REST API, replacing the old Setup step) | Cloudflare account and token creation | CALL-*, SHARE-*, REC-*, SYNC-* |
| H5 | tldraw.dev, then environment settings | `TLDRAW_LICENSE_KEY` (production key valid for the Salesforce app domain) | Licence purchase or trial | MARK-*, SYNC-* host rows |
| H6 | Environment settings | `SMF_TESTER_EMAIL`: the mailbox for persona verification and password-reset mail on devices | Choosing the mailbox | Device rows |
| H9 | Environment settings | `SMF_PKG_PROMOTE_OK=yes`, only if stage 64 reports a beta upgrade refusal (C-SMF5-2). Promotion is irreversible | Consent | PKG-02 |

**Dropped from earlier versions:**
- **H7 (vault approval).** The vault is disabled (ADR-0004 rev 2). Your decision on JWT recovery
  is a review item, not a setup step.
- **H8 (secrets typed into Salesforce Setup).** Now automated:
  - SMF-7 `ApiToken` is set by stage 45 from `CF_RTK_ORG_TOKEN`.
  - The SMF-12 signing secret is generated each deploy by stage 49 and set on both the Worker
    (`wrangler secret put`, stdin) and the External Credential (Connect REST). Both are verified
    end to end.

### H2 with JWT (one time, about 10 minutes)
1. On your own machine:
   `openssl req -x509 -newkey rsa:2048 -nodes -keyout smf-devhub.key -out smf-devhub.crt -days 365 -subj "/CN=smf-cloud"`
2. In the Dev Hub (Setup → External Client App Manager, or App Manager → New Connected App):
   - Enable OAuth with the scopes `api`, `refresh_token` and `web`.
   - Enable **JWT bearer flow** (use digital signatures) and upload `smf-devhub.crt`.
   - Set **Admin approved users are pre-authorized** and add the System Administrator profile.
   - Copy the consumer key.
3. In the environment settings, set:
   - `SF_DEVHUB_USERNAME`: the Dev Hub admin username;
   - `SF_DEVHUB_CLIENT_ID`: the consumer key;
   - `SF_DEVHUB_JWT_KEY`: the full text of `smf-devhub.key`.
   Optionally set `SF_DEVHUB_INSTANCE_URL` to your My Domain login URL.
4. Revocation: remove or rotate the certificate on the app, or delete the scratch orgs
   (ADR-0004 rev 2).

### Replacing a scratch org (only on your explicit instruction)
No environment variable can trigger replacement, and session startup never deletes an org. If a
stage reports an org that exists but cannot be recovered, tell the agent to replace it. The agent
then runs `orgs.py replace`, bound to that org's verified ID and admin username. That deletes
exactly that org through the Dev Hub and creates its successor.

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
stun.cloudflare.com
turn.cloudflare.com
*.workers.dev
dl.google.com
```

`dl.google.com` lets the agent install branded **Google Chrome** for the ENV-DESKTOP-CHROME row;
without it, only Playwright **Chromium** (a separate, non-substitute row) is available.
Microsoft Edge already installs from `packages.microsoft.com` (allowed by default).
`stun.cloudflare.com`/`turn.cloudflare.com` are the RealtimeKit ICE servers (SMF-7..9). Cloud
browsers reach them only over TCP/TLS through the egress proxy; if the proxy cannot carry them,
the cloud call rows report BLOCKED with that reason (people on real networks are unaffected).
The SMF-12 handoff lists any additional tldraw hosts.

## What the agent does after H1–H2

1. **`bash scripts/cloud/session-setup.sh`** (first command of each session):
   - sf CLI, skills, Microsoft Edge, bundle dependencies;
   - Dev Hub login and identity check (`scripts/cloud/orgs.py devhub`);
   - recovery of existing scratch orgs and personas found through the Dev Hub.
     **It never creates an org because a local alias is missing.**
2. **`scripts/cloud/pipeline.sh all`:**
   - readiness (ENV-*), scratch orgs, SMF-3 provisioning and access checks, SMF-4 deploy;
   - story stages, including the org and Cloudflare secrets;
   - cloud browser tests, packaging, matrix and evidence update.
