# SMF-5 PKG-01..03 — human-run script (installed package in the install-test org)

**Who:** Brandon or a designated tester. **Org:** `smf-install-test` (the subscriber; never
`smf-dev` or the Dev Hub). **Personas:** MF-TECH, MF-SUPPORT, MF-RESTRICTED as created *in
the install-test org* by SMF-3 tooling (credentials from the private mapping); MF-ADMIN
only for the admin steps marked **Admin**. **App:** "Field Support PoC" (App Launcher).
Operator steps (build, create, install, upgrade, reports) are in
`docs/smf-5/subscriber-runbook.md`; this script is only what a person does and observes.

**Who runs what:** the desktop rows are automated in the cloud by the agent
(`ENV-DESKTOP-EDGE`, plus `ENV-CLOUD-CHROMIUM` as a separate row and `ENV-DESKTOP-CHROME`
when branded Chrome is installable) — pipeline stages 63/64 run
`testing/cloud-e2e/tests/smf-5-package.spec.ts`, which performs PKG-01 steps 1–5, PKG-02 steps
1–3 and PKG-03 steps 1–4 below as the real personas. A person uses this script for the
**physical Salesforce mobile** rows (`ENV-SFMOBILE-IOS`, `ENV-SFMOBILE-ANDROID`: in the
Salesforce app, App Launcher → "Field Support PoC"; record device model, OS and Salesforce
app version) or as a manual desktop fallback. Packaging cases name no host matrix; mobile
runs are supplementary evidence for the installed app, recorded separately and never
copied from a desktop row. Use a private window (or a logged-out app) per persona.

Record each run in `testing/device-results/` (template there; the agent turns it into `evidence/SMF-5/<CASE>-<ENV-ROW>.md`) (fields from
`evidence/TEMPLATE.md`). Paste the "Copy for evidence" blocks. Screenshots: crop the URL
bar's org domain and any record IDs; never photograph faces. Write version **numbers**
(e.g. 1.0.0.1), never `04t…` IDs.

## PKG-01 — non-admin launches the installed v1

Precondition (operator): runbook steps 0–7 done; v1 installed; `FieldSupport_Access`
assigned to TECH, SUPPORT, RESTRICTED; `check_baseline.py` clean for the install-test org.

For MF-TECH, then MF-SUPPORT:

1. Log in to the install-test org as the persona. *Observe:* Salesforce home loads.
2. App Launcher → search "Field Support PoC". *Observe:* listed. Open it. *Record* the time
   from click to the "Launch check" heading.
3. *Observe:* "Signed in as <persona display name>" is the persona just logged in (not the
   admin). Tap **Copy for evidence** and paste.
4. Tap **Capability probes** → **SMF-5 · Package version marker**. *Observe:* the large
   marker reads **v1** and "Expected package version 1.0.0". Tap **Copy for evidence**, paste.
5. Reload the page (Ctrl+R). *Observe:* still renders, same marker, no login prompt.

**PASS** only if steps 2–5 hold for both TECH and SUPPORT. Admin success never counts.

## PKG-03 — permission denial in the install-test org (then restore)

1. **Admin:** remove `FieldSupport_Access` from MF-RESTRICTED (runbook step 9). *Record*
   the time.
2. As MF-RESTRICTED (fresh login): App Launcher → search "Field Support PoC". *Observe:*
   listed or not.
3. Open the app URL noted during PKG-01 (and `/probes/package-version` under it) as
   MF-RESTRICTED. *Record* the exact denial message/behaviour. It must not render the
   Launch check or the marker.
4. **Admin:** restore the assignment (runbook step 9) and run `check_baseline.py`.
   MF-RESTRICTED logs out/in. *Observe:* the app is listed again. *Record* restore time and
   the sanitized `check_baseline.py` summary.
5. Operator: attach the sanitized package operation reports
   (`evidence/SMF-5/reports/*.json`) and the limitations from the runbook.

**PASS** only if the app is neither listed nor reachable while removed, the baseline is
restored and verified, and the reports contain no auth material, usernames or IDs.

## PKG-02 — after the v1 → v2 upgrade

Precondition (operator): runbook steps 10–11 done; `state_snapshot.py compare` result and the
`FieldSupport_Access` assignment counts recorded before and after.

For MF-TECH, then MF-SUPPORT (no permission changes between upgrade and these steps):

1. Log in; App Launcher → "Field Support PoC". *Observe:* listed and opens (no re-assignment,
   no re-activation needed). If a stale page appears, hard-reload once and *record* that.
2. *Observe:* Launch check shows the right user. Copy for evidence.
3. Probes → **Package version marker**. *Observe:* marker reads **v2**, "Expected package
   version 1.1.0". Copy for evidence.
4. Open MF-CASE-001 in standard Salesforce (Cases tab). *Observe:* still visible to the
   persona with its subject/status unchanged and its image File (MF-IMAGE-001) listed.

**PASS** only if: installed list shows the v2 version number, the marker is v2 for both
personas, `state_snapshot.py compare` reports `"identical": true`, assignment counts are
unchanged, and step 4 holds for both personas.
