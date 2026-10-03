# ADR-0004: One human secret; org sessions restored from an encrypted vault in the Dev Hub

- **Status:** Proposed
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-2 (ENV-01..03), SMF-3 (DATA-01..03), all cloud-automated cases
- **Deciders:** Project owner (review); implementing agent (proposal)

## Context
Cloud containers are ephemeral; the local `sf` credential store is lost at the end of each
session. The agent cannot write environment secrets. Scratch orgs (dev, install-test) and the
persona users created in them must stay usable across sessions — device testers reuse them.

## Options
1. One auth URL per org/persona as environment secrets — many human steps, repeated whenever
   an org is recreated.
2. JWT with an External Client App and a human-held private key — two to three secrets plus
   app setup in the Dev Hub UI; persona JWT for scratch users is not documented for all users.
3. **One secret (`SF_AUTH_URL_DEVHUB`); everything else in an encrypted vault File inside the
   Dev Hub**, written and read by `scripts/cloud/vault.py`.

## Decision
Option 3. The vault is a private Salesforce File titled `smf-cloud-vault` owned by the Dev
Hub admin, AES-256 encrypted (openssl, PBKDF2, 200k iterations) with a key derived from
`SF_AUTH_URL_DEVHUB`. It holds the SFDX auth URLs of `smf-dev`, `smf-install-test` and the
persona aliases. Reading it requires Dev Hub admin access, which already controls those
scratch orgs.

## Consequences
- Revocation: delete the File or revoke the Dev Hub refresh token (Setup → Connected Apps
  OAuth Usage); rotate `SF_AUTH_URL_DEVHUB` after revocation.
- Persona sessions come from persona-scoped CLI auth (`sf org create user`), so cloud browser
  tests run as the real persona, never as an admin (`sf org open --url-only` frontdoor URL,
  which is never logged).
- If a persona auth URL is unavailable (e.g. the CLI cannot mint one for that user), the
  affected automated cases are BLOCKED with that reason; no admin substitute is used.
