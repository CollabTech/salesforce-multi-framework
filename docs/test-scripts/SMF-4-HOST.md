# SMF-4 HOST-01..03 — human-run script (desktop and physical Salesforce mobile)

**Who:** Brandon or a designated tester. **Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED
(credentials from `private/personas.json`; never MF-ADMIN for these cases).
**Org:** `smf-dev`. **App:** "Field Support PoC" (App Launcher). **Build:** the commit shown
on the Launch check page — it must match the PR head being tested.

Record each run in `evidence/SMF-4/<CASE>-<ENV-ROW>.md` (`evidence/TEMPLATE.md`). Paste the
"Copy for evidence" block. Screenshots: crop out the URL bar's org domain and any record
IDs before committing; never photograph faces.

| Env row | What to record first |
|---|---|
| ENV-DESKTOP-CHROME | Chrome version (chrome://version), OS version |
| ENV-DESKTOP-EDGE | Microsoft Edge version (edge://version), OS version |
| ENV-SFMOBILE-IOS | Device model, iOS version, Salesforce app version (app Settings > About) |
| ENV-SFMOBILE-ANDROID | Device model, Android version, Android System WebView version, Salesforce app version |

A mobile *browser* (Safari/Chrome on the phone) is a separate exploratory row and does not
satisfy ENV-SFMOBILE-*.

## HOST-01 — each intended user launches, navigates, reloads, keeps context

For MF-TECH, then MF-SUPPORT, in each env row (use a private window / separate browser
profile per persona on desktop; on mobile, log out of the Salesforce app between personas):

1. Log in to `smf-dev` as the persona. *Observe:* the Salesforce home loads.
2. Desktop: App Launcher → search "Field Support PoC" → open.
   Mobile: Salesforce app → menu (☰) → App Launcher / All Items → "Field Support PoC".
   *Record:* how the app opened (in Lightning frame / full screen / new browser tab / external
   browser) and the time from tap to the "Launch check" heading.
3. *Observe:* "Signed in as <persona display name>" — must be the persona just logged in.
   If an error shows instead, record its exact text.
4. Tap **Copy for evidence**; paste into the record (mobile: paste into a note and transfer).
5. Tap **Navigation check**. *Observe:* the route shows `/launch/navigation` and the same user.
6. Reload: desktop F5/Ctrl+R; mobile pull-to-refresh (or close and reopen the app tab).
   *Observe:* page still renders and shows the same user (no login prompt, no blank page).
7. Tap **Back to launch check**, then the device/browser Back button. *Observe:* no blank
   page or Salesforce error.

**PASS** for a row only if steps 3, 5, 6 and 7 hold for both TECH and SUPPORT.

## HOST-02 — RESTRICTED without the app permission cannot open the app; restore baseline

Admin step (MF-ADMIN, separate session): remove `FieldSupport_Access` from MF-RESTRICTED
(`docs/smf-4/deploy.md`). Then as MF-RESTRICTED in each env row:

1. App Launcher → search "Field Support PoC". *Observe:* listed or not.
2. If a direct app URL is known from HOST-01, open it as MF-RESTRICTED. *Observe and record
   the exact denial message or behaviour* (must not render the Launch check).
3. Admin restores `FieldSupport_Access`; MF-RESTRICTED logs out/in and confirms the app is
   listed again. *Record* the restore time and the `check_baseline.py` output.

**PASS** only if the app is neither listed nor reachable while removed, and the baseline is
restored and verified.

## HOST-03 — repeat per host and capture failed launches separately

Run HOST-01 and HOST-02 in all four required rows. If the app fails to open in a row,
record that row as FAIL with the exact behaviour (e.g. "Salesforce app shows 'This page
isn't available in Salesforce mobile'"), a screenshot, and app/OS versions. A device you do
not have is **BLOCKED** (name the missing device) — never copied from another row.
