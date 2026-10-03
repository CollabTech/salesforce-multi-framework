# DATA-02 — ENV-DESKTOP-EDGE — persona access check (Desktop Microsoft Edge)

**Case:** DATA-02 (SMF-3) — *TECH and SUPPORT can access MF-CASE-001 and its image; RESTRICTED cannot. All business personas are denied MF-CASE-002 and MF-FILE-DENIED.*  
**Environment row:** `ENV-DESKTOP-EDGE` (required).  **Who:** Brandon or a designated tester.  
**Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED (logical IDs; never MF-ADMIN).  
**Fixtures:** MF-ACCOUNT-001, MF-CASE-001, MF-CASE-002, MF-IMAGE-001 (sha256 in `testing/fixtures/manifest.json`), MF-FILE-DENIED.

> The record/File access part is automated in the cloud in official Microsoft Edge on Linux (stage 51). This script covers what automation cannot attest: an interactive password + MFA login on the tester's own Edge/OS.

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
   `testing/device-results/<YYYY-MM-DD>-DATA-02-ENV-DESKTOP-EDGE.md` and fill it in as you go.
5. Do not edit or create records or Files during this script (the update checks are automated).

**Record once:** Edge version (edge://version), OS name and version; the date/time with timezone; your name or role.

## Steps (one block per persona, in this order)

### MF-TECH

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | In a new Edge profile or InPrivate window per persona (no other Salesforce session open), open the private `smf-dev` login URL and log in as **MF-TECH** (password + verification as prompted). | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Tech Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | MF-CASE-001 *Pump overheating — remote diagnosis* is listed | listed Y/N |
| 4 | Paste the private **MF-CASE-001** link into the address bar of the same window. | The case opens: subject *Pump overheating — remote diagnosis*, account *CollabTech PoC Test Customer* | opened Y/N; exact subject shown |
| 5 | On the case, open the **Files** related list and tap/click **MF-IMAGE-001** | Preview shows the synthetic pump drawing labelled *MF-PUMP-001* with an *INLET* label | preview shown Y/N; what you saw |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Paste the private **MF-CASE-002** link into the address bar of the same window. | Access is denied | exact message |
| 8 | Paste the private **MF-FILE-DENIED** link into the address bar of the same window. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out and close the window | Login screen | — |

### MF-SUPPORT

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | In a new Edge profile or InPrivate window per persona (no other Salesforce session open), open the private `smf-dev` login URL and log in as **MF-SUPPORT** (password + verification as prompted). | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Support Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | MF-CASE-001 *Pump overheating — remote diagnosis* is listed | listed Y/N |
| 4 | Paste the private **MF-CASE-001** link into the address bar of the same window. | The case opens: subject *Pump overheating — remote diagnosis*, account *CollabTech PoC Test Customer* | opened Y/N; exact subject shown |
| 5 | On the case, open the **Files** related list and tap/click **MF-IMAGE-001** | Preview shows the synthetic pump drawing labelled *MF-PUMP-001* with an *INLET* label | preview shown Y/N; what you saw |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Paste the private **MF-CASE-002** link into the address bar of the same window. | Access is denied | exact message |
| 8 | Paste the private **MF-FILE-DENIED** link into the address bar of the same window. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out and close the window | Login screen | — |

### MF-RESTRICTED

| Step | Action | Expected | Record |
|---|---|---|---|
| 1 | In a new Edge profile or InPrivate window per persona (no other Salesforce session open), open the private `smf-dev` login URL and log in as **MF-RESTRICTED** (password + verification as prompted). | Home page loads as this persona | login worked Y/N; every prompt shown (verification, MFA, OS) |
| 2 | Open your user menu / avatar and read the name shown | `MF Restricted Persona` | name shown (logical persona only; do not write the username) |
| 3 | Search for `Pump overheating` | No case is listed | what the search showed |
| 4 | Paste the private **MF-CASE-001** link into the address bar of the same window. | Access is denied (e.g. *Insufficient Privileges* / *You don't have access*) | exact message |
| 5 | Paste the private **MF-IMAGE-001** link into the address bar of the same window. | Access is denied; no image is shown or downloaded | exact message |
| 6 | Search for `MF-CASE-002` | No case is listed | what the search showed |
| 7 | Paste the private **MF-CASE-002** link into the address bar of the same window. | Access is denied | exact message |
| 8 | Paste the private **MF-FILE-DENIED** link into the address bar of the same window. | Access is denied; no image is shown or downloaded | exact message |
| 9 | Log out and close the window | Login screen | — |

## Outcome you report

- **PASS** only if every *Expected* cell above matched for all three personas.
- **FAIL** if any allowed access was missing or any denial was not enforced (say which step).
- **PARTIAL** if some personas/steps could be run and matched and others did not; list them.
- **BLOCKED** if you could not run it (no device, login impossible, links missing) — name what is missing.

Do not include usernames, the org URL, record IDs, screenshots showing them, or faces. Crop screenshots to the relevant part. The agent turns your result into `evidence/SMF-3/DATA-02-ENV-DESKTOP-EDGE.md` and updates the matrix.
