# ENV-01 — n/a — org/CLI readiness — org identity, edition, Dev Hub, unlocked 2GP, Multi-Framework prerequisites

| Field | Value |
|---|---|
| Case ID | ENV-01 |
| Story | SMF-2 |
| Persona pair | MF-ADMIN (setup); Brandon for interactive authorization |
| Fixture IDs / hash / version | n/a |
| Build / commit | SMF-2 branch; readiness run at b79111a |
| Host / device / OS / app / browser | Linux cloud container; Salesforce CLI 2.152.14; Node v22.22.0; Python 3.11 |
| Environment row | n/a — org/CLI readiness |
| Timestamp | 2026-10-03T21:34:20Z |
| Preconditions | Accepted SMF-1 rules applied (AGENTS.md, bootstrap-skills, smf-salesforce-boundaries). Read-only script; explicit --target-org on every command. |
| Steps | 1. python3 scripts/sf/readiness.py --devhub smf-devhub --dev smf-dev --install-test smf-install-test --report evidence/SMF-2/readiness-2026-10-03.md 2. Probe egress: curl https://login.salesforce.com and https://test.salesforce.com 3. Collect current documented requirements from official domains (docs/smf-2/platform-requirements.md) |
| Expected result | Authenticate and verify the actual org identity/edition before any writes; independently verify Dev Hub, unlocked 2GP, and the current Multi-Framework prerequisites. |
| Actual result | No org could be authenticated: `sf org list` is empty (no local credential store entry) and the environment's egress proxy rejects CONNECT to login.salesforce.com and test.salesforce.com (connect_rejected, organization policy). Every org item returned NamedOrgNotFoundError. No org was read or written. Documented requirements were collected (R1–R10, D1–D5) but are not org observations. The existing browser login was not used or assumed. |
| Outcome | BLOCKED |
| Evidence link | evidence/SMF-2/readiness-2026-10-03.md; docs/smf-2/platform-requirements.md |
| Tester | Implementing agent (Claude Code cloud session) |
| Limitation / follow-up | Unblock: (1) allow egress to login.salesforce.com, test.salesforce.com, *.my.salesforce.com, *.salesforce.com, *.force.com, *.my.salesforce.app in the environment's network settings, and (2) provide an SFDX auth URL for the Dev Hub as a secret environment variable (SF_AUTH_URL_DEVHUB) — or run docs/smf-2/setup-path.md steps 2–6 on a contributor machine. Then rerun the readiness script. Salesforce app domain, Edge Network and Hyperforce need Brandon's Setup observations (setup-path step 5). |

## Re-check 2026-10-04 (outcome unchanged: BLOCKED)
- **Credentials:** no Dev Hub credential (neither the JWT trio nor `SF_AUTH_URL_DEVHUB`) is
  present in the environment.
- **Network:** every Salesforce, Cloudflare and Google host fails with curl exit 56 ("CONNECT
  tunnel failed, response 403"). The egress proxy's own reply body states the reason:
  `request blocked: no rule or allowlist entry allows host "<host>"`. That is an environment
  network-policy (allowlist) denial, not an upstream failure. Package registries
  (`registry.npmjs.org`, `packages.microsoft.com`) open the tunnel and return 200.
- **Stages:** stage 10 and `scripts/cloud/orgs.py devhub` report BLOCKED (exit 2).
- **Log** (sanitized; written by `scripts/cloud/net_readiness.py`):
  `evidence/SMF-2/logs/readiness-2026-10-04.txt`.
- **Smallest unblocking action:** HUMAN-SETUP H1 (allowlist the listed domains) and H2 (the JWT
  trio).
