# Private mapping format (`private/`, git-ignored)

Real identifiers never enter Git. Each contributor keeps them locally in `private/`
(listed in `.gitignore`) or in the OS credential store. Public files use only the logical
IDs on the left. Suggested files — the field names are a convention, not a contract:

`private/orgs.json` — written by SMF-2
```json
{ "dev-hub":      { "alias": "<local sf alias>", "org_id": "<private>" },
  "dev":          { "alias": "<local sf alias>", "org_id": "<private>" },
  "install-test": { "alias": "<local sf alias>", "org_id": "<private>" } }
```

`private/personas.json` — written by SMF-3
```json
{ "MF-ADMIN": { "org": "dev", "username": "<private>", "user_id": "<private>" },
  "MF-TECH": { "...": "..." }, "MF-SUPPORT": { "...": "..." }, "MF-RESTRICTED": { "...": "..." } }
```

`private/fixtures.json` — written by SMF-3: logical fixture ID → per-org record IDs.

Credentials (passwords, passkeys, tokens, auth URLs) go in the `sf` CLI's credential store
only — not in these files. Evidence refers to `dev`, `install-test`, and persona IDs.
