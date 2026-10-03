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

`private/personas.json` — written by SMF-3 (`testing/provisioning/personas.py`)
```json
{ "MF-ADMIN": { "org": "dev", "org_alias": "smf-dev", "username": "<private>", "user_id": "<private>" },
  "MF-TECH": { "org": "dev", "org_alias": "smf-dev", "cli_alias": "smf-dev-tech",
               "username": "<private>", "user_id": "<private>", "profile": "...", "role": null,
               "permission_sets": ["..."] },
  "MF-SUPPORT": { "...": "..." }, "MF-RESTRICTED": { "...": "..." } }
```
In the org, personas are found by `User.FederationIdentifier` = the logical persona ID, so no
username is needed in public files.

`private/fixtures.json` — written by SMF-3 (`fixtures.py`): per org alias, logical fixture ID →
record IDs. `private/smf3/` holds raw CLI output of the SMF-3 scripts (may contain usernames,
IDs and, for `sf org create user`, the generated password) — never copy it into `evidence/`.

Credentials (passwords, passkeys, tokens, auth URLs) go in the `sf` CLI's credential store
only — not in these files. Evidence refers to `dev`, `install-test`, and persona IDs.

`private/packages.json` — written by SMF-5 (`docs/smf-5/subscriber-runbook.md`): the package
`0Ho…` ID, per version the `08c…` create request, `04t…` version ID, version number and
commit, and the `0Hf…` install requests. Raw `sf package … --json` output goes in
`private/smf5/`; only `scripts/smf5/sanitize_report.py` output is published.
