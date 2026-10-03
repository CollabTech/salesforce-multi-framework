# SMF-2 readiness report (sanitized)

Generated 2026-10-03T21:34:20Z by `scripts/sf/readiness.py` at commit `b79111a`; sf 2.152.14; node v22.22.0; host linux.

Org identifiers and usernames are kept in `private/smf2/` only.

| Case | Item | Outcome | Observed (sanitized) | Unblocking action |
|---|---|---|---|---|
| ENV-01 | devhub: authenticate + identity | BLOCKED | query failed: NamedOrgNotFoundError | `sf org login web --alias smf-devhub` (Brandon completes any passkey prompt) |
| ENV-01 | dev: authenticate + identity | BLOCKED | query failed: NamedOrgNotFoundError | `sf org login web --alias smf-dev` (Brandon completes any passkey prompt) |
| ENV-01 | install-test: authenticate + identity | BLOCKED | query failed: NamedOrgNotFoundError | `sf org login web --alias smf-install-test` (Brandon completes any passkey prompt) |
| ENV-03 | dev and install-test are different orgs | BLOCKED | distinct=False; dev is Dev Hub=unknown | create the install-test scratch org (docs/smf-2/setup-path.md step 4) |
