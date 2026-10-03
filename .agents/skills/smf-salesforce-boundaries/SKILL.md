---
name: smf-salesforce-boundaries
description: "Use whenever work touches a Salesforce org, Salesforce data/Files/permissions, or an external service (RealtimeKit, tldraw sync) that must be authorised against a Salesforce case. Defines org targeting, data, and authorization boundaries."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Salesforce integration boundaries

**Org targeting**
- Pass `--target-org <alias>` on every org-touching command. Never rely on a default org.
- Before the first write in a session, verify org identity/edition
  (`sf org display --target-org <alias>`) and record only sanitized results.
- The Dev Hub is not an application test org. Dev org and install-test org are separate
  (SMF-2 ENV-03). ADMIN sessions never stand in for business-user evidence.

**Data**
- Synthetic fixtures only (`testing/contract.json`). Seed idempotently; reset touches only
  PoC records. Use the target org's verified schema — do not invent field names.
- Real usernames, org IDs, record IDs, provider room IDs, and tokens live in `private/`
  (git-ignored) or the local credential store, never in Git, PRs, or Jira.

**Authorization**
- Salesforce is the source of truth for who can see a case, its Files, and its rooms.
  External services get access only through a server-side check that binds the caller to
  the case (e.g. Apex issuing short-lived participant credentials after a sharing check).
- Never trust client-supplied case IDs or room IDs without that check.
- Profiles, roles, sharing rules, and permission sets must not accidentally bypass the
  MF-RESTRICTED denial baseline.

**Mechanics**: follow the official skills (`dx-org-*`, `platform-permission-set-generate`,
`platform-sharing-*`, `platform-data-manage`, `experience-ui-bundle-salesforce-data-access`,
`experience-ui-bundle-file-upload-generate`, `platform-apex-*`). If this file seems to
contradict one, the official skill wins for mechanics — record the conflict in
`docs/contradictions.md`.
