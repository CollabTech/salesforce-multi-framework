# DATA-02 — ENV-SFMOBILE-IOS — persona access check (Salesforce mobile app on a physical iPhone/iPad)

**Case:** DATA-02 (SMF-3) — *TECH and SUPPORT can access MF-CASE-001 and its image; RESTRICTED cannot. All business personas are denied MF-CASE-002 and MF-FILE-DENIED.*  
**Environment row:** `ENV-SFMOBILE-IOS` (required).  **Who:** Brandon or a designated tester.  
**Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED (logical IDs; never MF-ADMIN).  
**Fixtures:** MF-ACCOUNT-001, MF-CASE-001, MF-CASE-002, MF-IMAGE-001 (sha256 in `testing/fixtures/manifest.json`), MF-FILE-DENIED.

> Not automatable: physical-device evidence only. An emulator, simulator or mobile browser never fills this row.

## Before you start (the agent prepares these; nothing here goes into Git, Jira or chat logs)

1. Stages 30–32 have run in the cloud (`scripts/cloud/pipeline.sh 30 31 32`): personas and
   fixtures exist in `smf-dev`. The agent confirms the latest `evidence/SMF-3/runs/*-DATA-01.json`
   shows one record per fixture key.
2. The agent sends you **privately** (not in Git/Jira): the `smf-dev` login URL, the three
   persona usernames, and four direct links — MF-CASE-001, MF-IMAGE-001 (File page),
   MF-CASE-002, MF-FILE-DENIED (File page).
3. Persona e-mail is the tester mailbox set in `SMF_TESTER_EMAIL` (HUMAN-SETUP H6). First login
   for a persona: use **Forgot Your Password?** with the username; set a password from the
   e-mail; complete the identity verification / MFA registration Salesforce asks for
   (authenticator app). Do not ask anyone to waive MFA.
4. Copy `testing/device-results/TEMPLATE.md` to
   `testing/device-results/<YYYY-MM-DD>-DATA-02-ENV-SFMOBILE-IOS.md` and fill it in as you go.
5. Do not edit or create records or Files during this script (the update checks are automated).

**Record once:** device model, iOS version, Salesforce app version (App Store page or the app's Settings > About); the date/time with timezone; your name or role.

## Steps (one block per persona, in this order)

### MF-TECH

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | Open the Salesforce app. On the login screen tap the menu / gear → **Change Server** (iOS) or **⋮ → Change Server** (Android) → add the private `smf-dev` login URL as a custom domain, select it, and log in as **MF-TECH** (password + verification as prompted). Allow or deny notification prompts as you like; note any prompt you saw. | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Tech Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | MF-CASE-001 *Pump overheating — remote diagnosis* is listed | listed Y/N |
| 4 | Open the private **MF-CASE-001** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | The case opens: subject *Pump overheating — remote diagnosis*, account *CollabTech PoC Test Customer* | opened Y/N; exact subject shown |
| 5 | On the case, open the **Files** related list and tap/click **MF-IMAGE-001** | Preview shows the synthetic pump drawing labelled *MF-PUMP-001* with an *INLET* label | preview shown Y/N; what you saw |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Open the private **MF-CASE-002** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied | exact message |
| 8 | Open the private **MF-FILE-DENIED** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out (avatar → Log Out) | Login screen | — |

### MF-SUPPORT

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | Open the Salesforce app. On the login screen tap the menu / gear → **Change Server** (iOS) or **⋮ → Change Server** (Android) → add the private `smf-dev` login URL as a custom domain, select it, and log in as **MF-SUPPORT** (password + verification as prompted). Allow or deny notification prompts as you like; note any prompt you saw. | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Support Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | MF-CASE-001 *Pump overheating — remote diagnosis* is listed | listed Y/N |
| 4 | Open the private **MF-CASE-001** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | The case opens: subject *Pump overheating — remote diagnosis*, account *CollabTech PoC Test Customer* | opened Y/N; exact subject shown |
| 5 | On the case, open the **Files** related list and tap/click **MF-IMAGE-001** | Preview shows the synthetic pump drawing labelled *MF-PUMP-001* with an *INLET* label | preview shown Y/N; what you saw |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Open the private **MF-CASE-002** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied | exact message |
| 8 | Open the private **MF-FILE-DENIED** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out (avatar → Log Out) | Login screen | — |

### MF-RESTRICTED

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | Open the Salesforce app. On the login screen tap the menu / gear → **Change Server** (iOS) or **⋮ → Change Server** (Android) → add the private `smf-dev` login URL as a custom domain, select it, and log in as **MF-RESTRICTED** (password + verification as prompted). Allow or deny notification prompts as you like; note any prompt you saw. | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Restricted Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | No case is listed | what the search showed |
| 4 | Open the private **MF-CASE-001** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied (e.g. *Insufficient Privileges* / *You don't have access*) | exact message |
| 5 | Open the private **MF-IMAGE-001** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied; no image is shown or downloaded | exact message |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Open the private **MF-CASE-002** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied | exact message |
| 8 | Open the private **MF-FILE-DENIED** link on this device (tap it in the private message). Note whether it opened in the Salesforce app or in a browser; if it opened in a browser, go back and instead use the app's search for the subject/title below, and note that. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out (avatar → Log Out) | Login screen | — |

## Outcome you report

- **PASS** only if every *Expected* cell above matched for all three personas.
- **FAIL** if any allowed access was missing or any denial was not enforced (say which step).
- **PARTIAL** if some personas/steps could be run and matched and others did not; list them.
- **BLOCKED** if you could not run it (no device, login impossible, links missing) — name what is missing.

Do not include usernames, the org URL, record IDs, screenshots showing them, or faces. Crop screenshots to the relevant part. The agent turns your result into `evidence/SMF-3/DATA-02-ENV-SFMOBILE-IOS.md` and updates the matrix.
