---
name: smf-public-provenance
description: "Use before committing, opening a PR, commenting in Jira, or publishing anything from the salesforce-multi-framework repo (a public repository). Defines what curated provenance to keep and what must never be published."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Public provenance

This repository is **public**. Treat every commit, PR, and evidence file as published.

**Keep (curated)** — in `docs/provenance/`, `docs/adr/`, `evidence/`:
- The task instruction source (story key + retrieval date), decisions with rationale,
  what changed, and verification results.
- Upstream sources and pinned revisions of third-party skills, tools, and assets.
- Short summaries of agent sessions (`docs/provenance/sessions/`), not raw transcripts.

**Never publish**: passwords, passkeys, tokens, OAuth/JWT material, `sf` auth files or
`sfdxAuthUrl`, private org IDs, real usernames/emails of test users, Salesforce record IDs,
provider room IDs or participant credentials, raw private conversations, customer data,
images with people or location metadata.

**Before publishing**: run `python3 scripts/scan-public-content.py`, review the diff by eye,
and strip EXIF from images. If something private was pushed, stop and tell Brandon — rotating
the credential comes before rewriting history.
