# ADR-0004: Cross-session org access for ephemeral cloud containers

- **Status:** rev 2, 2026-10-04.
  - The custom vault (rev 1, Option 3) is **disabled** and must not be used for the first real
    run. The owner directed this on 2026-10-04.
  - Option 2 (JWT) is **proposed**, pending the owner's decision.
- **Story / case IDs:** SMF-2 (ENV-01..03), SMF-3 (DATA-01..03), all cloud-automated cases.
- **Deciders:** project owner (decision); implementing agent (proposal).

## Context
Cloud containers are ephemeral, so the local `sf` credential store is lost when a session ends.
Scratch orgs (`smf-dev`, `smf-install-test`) and the persona users in them must stay usable
across sessions, and a new session must never create a duplicate scratch org just because it
has no local alias.

## Correction of rev 1 (vault) revocation claims
Rev 1 stated: "Revocation: delete the File or revoke the Dev Hub refresh token; rotate
`SF_AUTH_URL_DEVHUB` after revocation." That was wrong or incomplete:

1. **Deleting the vault File revokes nothing.** The File holds copies of refresh tokens.
   Deleting it moves it to the Recycle Bin and leaves every token valid. It does nothing about
   copies already decrypted in a container.
2. **Revoking the Dev Hub's refresh token does not revoke scratch-org or persona tokens.** Each
   scratch org is a separate org that issued its own tokens, so they must be revoked in that org
   (Setup → Connected Apps OAuth Usage, or the user's OAuth Connected Apps list). The org can
   also be deleted, which ends every session and token it issued.
3. **Rotating `SF_AUTH_URL_DEVHUB` does not protect the vault.** The encryption key was derived
   from that URL, so anyone holding the old URL can still decrypt an old copy of the vault. The
   encryption therefore added no protection beyond the Dev Hub credential itself. If that
   credential leaked, every stored org and persona credential leaked with it.
4. Rev 1 said "reading it requires Dev Hub admin access". In fact the File is readable by its
   owner and by anyone with file access in the Dev Hub (for example View All Data). Decryption
   then needs only the Dev Hub auth URL.

## Options
1. **One auth URL per org or persona as environment secrets.** Many human steps, repeated every
   time an org is recreated.
2. **JWT Dev Hub auth (proposed).** A connected app or External Client App in the Dev Hub with an
   uploaded certificate. The environment holds three values: `SF_DEVHUB_USERNAME`,
   `SF_DEVHUB_CLIENT_ID` and `SF_DEVHUB_JWT_KEY` (the private key).
3. **Encrypted vault File in the Dev Hub (rev 1).** Disabled, for the reasons above.

## Proposal: Option 2, with server-side discovery (`scripts/cloud/orgs.py`)
- **What is verified offline (from the installed Salesforce CLI 2.152.14, `@salesforce/core`):**
  - **Scratch-org admin.** When the Dev Hub's auth carries a private key,
    `scratchOrgInfoApi.js buildOAuth2Options` authorizes a new scratch org's admin by JWT, using
    the Dev Hub's client ID and key.
  - **Persona users.** `user.js createUser` stores the admin's private key with each user the
    CLI creates.
  - **Consequence.** A new container can re-authorize the existing admin and persona users with
    `sf org login jwt --username … --client-id … --jwt-key-file …`. No per-org secret is stored.
- **Duplicate prevention.** Existing orgs are found through the Dev Hub's `ScratchOrgInfo`
  records (`Status = 'Active'`, matched on the definition file's `OrgName`), never through the
  local alias.
  - An active org is either recovered, or the role is BLOCKED with that org's expiry date.
  - A replacement is created only when the owner sets `SMF_RECREATE_DEV` or
    `SMF_RECREATE_INSTALL_TEST` to `yes`. The old org is then deleted through its
    `ActiveScratchOrg` record before the new one is created.
  - Two active orgs for one role are BLOCKED, with no automatic choice.
  - Unit tests: `scripts/tests/test_orgs_recovery.py`.
- **Identity checks** (`orgs.py devhub` / `ensure`):
  - The Dev Hub is enabled.
  - Each role's org ID matches its active `ScratchOrgInfo` record and is not the Dev Hub's.
  - Identities are recorded only in `private/identity.json`.
- **With only `SF_AUTH_URL_DEVHUB`**, the CLI authorizes new scratch orgs by auth-code exchange
  and keeps nothing a later container can reuse. Every session then reports existing orgs as
  BLOCKED instead of recreating them.

### Revocation under Option 2
- **Stop all new logins.** Remove or rotate the certificate on the Dev Hub app, or block the app.
  To verify at the first run: a JWT login to an existing scratch org fails after the certificate
  is rotated. If it still succeeds, delete the scratch orgs instead.
- **Sessions already issued by JWT** have no refresh token. They last until the session timeout.
  End them by deleting the scratch org, or by revoking the session in that org.
- **Scratch-org deletion** (`ActiveScratchOrg` delete in the Dev Hub) ends all access to that
  org.

### Not yet verified (checked by the first real run, recorded in `evidence/SMF-2/`)
- JWT login of each persona user in a scratch org with the Dev Hub app. It depends on that app
  being usable for those users in the scratch org.
- If the app is not usable for them, persona aliases exist only in the container that created
  them. The affected automated cases are then BLOCKED with that reason. An admin session is never
  substituted.

## Consequences
- **First run:**
  - The agent uses whichever Dev Hub credential is present.
  - The vault is never written or read: `scripts/cloud/vault.py` refuses unless both
    `SMF_VAULT_APPROVED` and `SMF_VAULT_ENABLE` are set to `yes`.
- **If the owner accepts Option 2:** the human setup becomes one Dev Hub app with a certificate
  (HUMAN-SETUP H2), and `SF_AUTH_URL_DEVHUB` is no longer needed.
