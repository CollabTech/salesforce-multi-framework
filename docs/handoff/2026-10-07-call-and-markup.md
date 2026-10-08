# Handoff: SMF-7 call and SMF-11 markup probes in smf-dev (2026-10-07)

Final bounded cloud-agent pass. Secrets, usernames, org URLs and the CLI authorization export are
in the private handoff file delivered separately (`private/SMF-HANDOFF-PRIVATE.txt`, git-ignored).

## Deployed
| Item | Identifier |
|---|---|
| Branch / PR | `claude/first-run-readiness` / PR #16 |
| UI bundle (licensed tldraw build) | Metadata deploy `0AfE200000qlpxBKAQ`, built from commit `f074341` (embedded as the build commit), main asset `index-B-joMZiI.js`, 253 components, 2026-10-07 23:44 UTC |
| SMF-7 server side | SMF7 objects, classes, custom permission, credentials, `SMF7_Access`; config record for the existing RealtimeKit app (preset `group_call_host`); org token stored in `SMF7_Cloudflare/SMF7_Principal.ApiToken` (encrypted) |
| SMF-10/11 server side | SMF10/SMF11 classes, `SMF10_Access`, `SMF11_Access` |
| SMF-3 data | Personas MF-TECH, MF-SUPPORT, MF-RESTRICTED; MF-CASE-001/002, MF-ACCOUNT-001, MF-ASSET-001/002, MF-IMAGE-001 (linked to MF-CASE-001), MF-FILE-DENIED (linked to MF-CASE-002) |

Probe paths (prefix with the org's `salesforce.app` origin from the private file):
`/app/c__FieldSupport/probes/call` and `/app/c__FieldSupport/probes/markup`.
The Lightning path `/lightning/app/c__FieldSupport` shows "no navigation items" by design
(Multi-Framework GA apps run on the salesforce.app domain).

## Verified by the cloud agent (real org, real persona sessions)
| Check | Result |
|---|---|
| SMF-7 org readiness (`checkConfiguration`) | OK (Cloudflare presets listed through the Named Credential) |
| MF-TECH participant token | HTTP 200, token issued |
| MF-SUPPORT participant token | HTTP 200, same meeting as MF-TECH (meetingId claim hash equal), distinct participant |
| MF-RESTRICTED | HTTP 403 `NO_CASE_ACCESS`, no token; Case query `INVALID_TYPE` |
| SMF-7 Apex tests | 28/28 pass, coverage 91% |
| SMF-10/11 Apex tests | 33/33 pass, coverage 88% |
| SMF-3 DATA-01 seed-twice | OK (one record per key, owner MF-ADMIN, Files linked as Viewer, no public links) |
| MF-TECH lists MF-CASE-001 Files / downloads MF-IMAGE-001 | 200 / 200, PNG 480,986 bytes |
| MF-SUPPORT reads markup state of MF-CASE-001 | 200 (no revision yet) |
| MF-RESTRICTED reads markup state of MF-CASE-001 | 404 |

## Verified in the real host (salesforce.app), 2026-10-08, after `*.salesforce.app` was allowed
Headless Chromium, persona logins through the org login page. Fake camera/microphone: media results
below are not real capture.

| Check | Result |
|---|---|
| Call page loads as MF-TECH (`/probes/call`) | Yes, build `f074341` shown in diagnostics |
| Find MF-CASE-001 in the page | MF-TECH and MF-SUPPORT: "MF-CASE-001 visible to you"; MF-RESTRICTED: lookup refused (GraphQL `FieldUndefined` on `Case`: no Case access; correct outcome, technical message) |
| Join in the page | Authorization obtained; RealtimeKit SDK then fails `SDK_ERROR` because this environment cannot reach `api.realtime.cloudflare.com` (`ERR_TUNNEL_CONNECTION_FAILED`). No CSP violation for that host. **Not a media result.** |
| Markup page loads as MF-TECH (`/probes/markup`) | Yes; no licence-blocked or mock banner |
| Draw → save to Salesforce Files → read back | MF-TECH drew a red ellipse on MF-IMAGE-001, saved revision r3; the annotated export read back from Files shows the ellipse |
| Reopen in a new session | MF-TECH and MF-SUPPORT reopen r3: `geo/ellipse/red` over the image; MF-RESTRICTED: "DENIED: Not found or no access." |
| tldraw licence | Key accepted at build; at runtime tldraw reports `license_type=evaluation` / `sku=evaluation`. No watermark visible in screenshots. Its watermark-tracker request to `cdn.tldraw.com` is blocked by the org CSP (`connect-src`). |
| Other console errors | CSP blocks a `data:application/json` fetch (`connect-src`); a Lightning Out container request returns 400 (`/lwr/application/amd/.../lightningout/container`); neither stopped the probes |

Markup revisions now on MF-CASE-001: r1 and r2 (automation, image only) and r3 (red ellipse).
Testers continue from r3.

## Still needs human testing
| Item | Why |
|---|---|
| Two-person audio/video, mute, camera toggle, leave/rejoin | Real devices; this environment cannot reach RealtimeKit media hosts |
| Markup on iPhone (Salesforce app and Safari), SUPPORT annotation (arrow + "Inspect inlet") | Device/touch |
| Licence decision | tldraw reports an evaluation licence; confirm the intended production key, and whether `cdn.tldraw.com` should be a CSP trusted site |

## Defects fixed in this pass (all found on the first live run)
SMF-7: `allowMergeFieldsInHeader` on `SMF7_Cloudflare` (header formula was not sent → Cloudflare 400);
Read on `UserExternalCredential` in `SMF7_Access` (persona callout failed → 500); access sweep split
into Schedulable + `SMF7_AccessSweep.Job` (Queueable could not be enqueued); credential verification
reads the stored parameter (Custom protocol reports `Unknown`); test fixes (alias collisions with the
real personas, two-request tests silently failing on callout-after-DML, explicit system mode).
SMF-10/11: reserved identifier `export`; descriptions over 255 characters; invalid test time zone;
tests read Files as their owner. SMF-3: `running_user` used the org id as the user id (cases never
matched MF-ADMIN; images re-uploaded each seed) — fixed, and the two unlinked duplicates deleted.

## Org changes made for automated checks (scratch org only)
- One trusted login IP range (this environment's egress /24; exact range in the private file), so persona logins
  are not challenged for a security token. Remove in Setup → Network Access if unwanted.
- Persona first-login password change completed; current passwords are in the private file.
- Debug log trace flags on MF-TECH and the admin (expire automatically).

## Known open items (not addressed in this pass)
- Capture probe playback/fullscreen issues reported by the testers remain open (see the tester notes).
- SMF-12 uses the same patterns that failed for SMF-7 (header formula without
  `allowMergeFieldsInHeader`, no `UserExternalCredential` read, sweep implementing Schedulable and
  Queueable). Not deployed or fixed here.
- SMF-7 tokens last 100 days (finding A1); the access sweep is deployed but stopped (baseline state).

## Desktop / iPhone test steps
Log in on the org's login page from the private file, then open the probe path.
1. Call (two people): MF-TECH on one device, MF-SUPPORT on another. Each opens `/probes/call`,
   presses Find MF-CASE-001, then Join. Check: both in the same room, see and hear each other;
   mute/unmute each side; camera off/on each side; one leaves and rejoins, then the other.
   MF-RESTRICTED (third browser): Find must report not visible; Join must be refused.
2. Markup (MF-TECH): open `/probes/markup`, load MF-IMAGE-001, draw an annotation, Save to Files,
   reload the page and reopen the saved markup. Then MF-SUPPORT opens the same and sees it.
   Record any licence watermark or console error verbatim.
3. iPhone: repeat 1 and 2 in the Salesforce mobile app and in Safari as separate results.
Report per step: pass/fail, device, browser/app version.

## Continue locally
```
git checkout claude/first-run-readiness
sf org login sfdx-url --sfdx-url-file smf-dev.authurl --alias smf-dev   # file from the private handoff
sf org open --target-org smf-dev
# redeploy the bundle with the licence (needs TLDRAW_LICENSE_KEY in your shell):
bash scripts/cloud/stages/48-smf11-tldraw-license.sh
# SMF-7 checks
sf apex run test --class-names SMF7_CallAuthServiceTest --class-names SMF7_CallTokenRestResourceTest --class-names SMF7_AccessSweepTest --target-org smf-dev --wait 30
# Files/markup checks
bash scripts/cloud/stages/46-smf10-files-access.sh
```
