# SMF-10 FILE-01..04 — human-run script (desktop and physical Salesforce mobile)

**Who:** Brandon or a designated tester (MF-ADMIN steps by whoever holds the admin login).
**Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED (credentials from `private/personas.json`;
never MF-ADMIN for business-user results). **Fixtures:** MF-CASE-001, MF-CASE-002,
MF-IMAGE-001, MF-FILE-DENIED, MF-UPLOAD-INVALID (SMF-3 assets; record their sha256 from the
SMF-3 fixture manifest). **Org:** `smf-dev`. **App:** Field Support PoC → Probes → "SMF-10 ·
Case image in Salesforce Files". **Build:** the commit shown in the evidence block must match
the PR head under test.

Record each run as `evidence/SMF-10/<CASE>-<ENV-ROW>.md`. Paste the probe's **Copy for
evidence** block (Ids are masked). Real record Ids go only into `private/` notes.

| Env row | Record first |
|---|---|
| ENV-DESKTOP-CHROME | Chrome version (chrome://version), OS version |
| ENV-DESKTOP-EDGE | Edge version (edge://version), OS version |
| ENV-SFMOBILE-IOS | Device model, iOS version, Salesforce app version |
| ENV-SFMOBILE-ANDROID | Device model, Android version, WebView version, Salesforce app version |

Mobile Safari/Chrome are separate exploratory rows and never satisfy ENV-SFMOBILE-*.

## 0. Setup (MF-ADMIN, once)
1. App (stage 40): `sf project deploy start --source-dir force-app --target-org smf-dev --wait 30`; probe metadata (not packaged, stage 46): `sf project deploy start --source-dir probes/main/default/classes --source-dir probes/main/default/permissionsets/SMF10_Access.permissionset-meta.xml --target-org smf-dev --wait 30`
2. Assign `SMF10_Access` to MF-TECH, MF-SUPPORT **and** MF-RESTRICTED:
   `sf org assign permset --name SMF10_Access --on-behalf-of <user> --target-org smf-dev` (×3).
3. `sf apex run test --class-names SMF10_CaseFilesServiceTest --class-names SMF10_CaseFilesResourceTest --target-org smf-dev --result-format human --code-coverage --wait 20` — record pass/fail counts and coverage.
4. Confirm Case OWD is Private (SMF-3 baseline) — the Apex denial tests assume it.

## FILE-01 — upload, verify record link, read as SUPPORT from a fresh session
Per env row:
1. Log in as **MF-TECH**. Open the probe. Paste MF-CASE-001's Id into *Case record Id*.
2. Choose MF-IMAGE-001. *Observe:* dashed panel "Browser-local preview — NOT persisted".
3. Tap **Upload to Salesforce Files**. *Observe:* phases checking → uploading (progress bar) →
   linking → verifying → persisted; green panel "Persisted Salesforce File".
4. *Record:* Linked to this case = true; Files with this key = 1; Bytes match = true; Public
   links visible = 0 or unknown; masked ContentDocument/ContentVersion. Copy the evidence block.
   Note the full ContentVersion Id privately.
5. Close the browser/app completely (desktop: close the private window; mobile: log out of
   the Salesforce app). Log in as **MF-SUPPORT** in a new session.
6. Open the probe, paste MF-CASE-001's Id, tap **List Files on this case** → *Observe:* the
   File is listed. Tap **use**, then **Retrieve File bytes**. *Observe:* image shown, SHA-256
   prefix equals the one from step 4.
7. MF-ADMIN (separate session) cross-check in Salesforce UI: MF-CASE-001 → Files related list
   shows the File. Record "linked: yes".

**PASS (row):** steps 3–4 hold for TECH and step 6 for SUPPORT with matching hash.

## FILE-02 — denials and no public link
Per env row:
1. As **MF-RESTRICTED** (fresh session): open the probe, paste MF-CASE-001's Id, **List
   Files** → *Expected:* "DENIED: Not found or no access." Paste the MF-IMAGE-001 ContentVersion
   Id from FILE-01 → **Retrieve** → *Expected:* DENIED. Also try opening MF-CASE-001 in the
   standard Salesforce UI and record the behaviour.
2. As **MF-TECH**, then **MF-SUPPORT**: retrieve the MF-FILE-DENIED ContentVersion Id
   (from `private/`) → *Expected:* DENIED. List MF-CASE-002 → *Expected:* DENIED.
3. MF-ADMIN: `sf data query --query "SELECT COUNT() FROM ContentDistribution WHERE ContentDocumentId IN ('<MF-IMAGE-001 doc>','<MF-FILE-DENIED doc>')" --target-org smf-dev` → *Expected:* 0. Record the count only.

**PASS (row):** every attempt in 1–2 is denied and step 3 returns 0.

## FILE-03 — invalid files, cancel, failure, retry, no duplicates
As **MF-TECH**, per env row (tick "Picker shows all file types" to select the .txt):
1. Choose the MF-UPLOAD-INVALID .txt → *Expected:* "Rejected (type-not-allowed) … Nothing was
   uploaded." Upload button disabled.
2. Choose the MF-UPLOAD-INVALID >5 MiB image → *Expected:* "Rejected (too-large) … limit is
   5.00 MiB."
3. Choose MF-IMAGE-001, tap Upload, then **Cancel** while the progress bar moves.
   *Expected:* phase "cancelled". Tap **Retry upload** → persisted; Files with this key = 1.
4. Failure: choose MF-IMAGE-001 again (new key), tap Upload and immediately switch the device to
   airplane mode / disconnect the network (desktop: DevTools → Network → Offline).
   *Expected:* phase "failed" with an error message. Reconnect, tap **Retry upload** →
   persisted; Files with this key = 1.
5. **List Files on this case**. *Expected:* exactly one File per *selection* made in steps 3–4
   (2 new Files), no extra copies. Record the count before and after.

**PASS (row):** 1–2 rejected without any upload; 3–4 recover with one File each; 5 shows no
unintended duplicate.

## FILE-04 — repeat on physical Salesforce mobile and desktop
Run FILE-01 steps 1–6 in ENV-SFMOBILE-IOS and ENV-SFMOBILE-ANDROID (and both desktop rows).
Additionally record: how the file picker appears (camera / photo library / files), whether a
camera photo arrives as JPEG or is rejected (e.g. HEIC → type-not-allowed — that is a finding,
record it, do not change the policy), and whether viewing works after logging out and back in
(reauthentication). A missing device is BLOCKED for that row, never copied from desktop.

**Human-only observations:** picker behaviour, image visibly rendered, reauthentication prompts.
