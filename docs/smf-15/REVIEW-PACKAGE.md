# SMF-15 review package: capability matrix, gate status and a proposed workflow

**Status: prepared for project-owner review. The gate is INCOMPLETE.** Prepared on
2026-10-03 by the implementing agent (Claude Code cloud session) from branch
`claude/smf-15-review`, which merges every story branch (SMF-1..14).

- Nothing in this package was executed against a Salesforce org, a persona session, a
  physical device or a Cloudflare/tldraw service. None of those were reachable from the cloud
  environment (HUMAN-SETUP H1/H2).
- No person has executed or reviewed any test reported here.
- Every capability statement below is either a **BLOCKED** required row or a
  **supplementary** localhost result. Supplementary results never satisfy a required row.
- Under SMF-15 AC2, these BLOCKED/NOT TESTED cells prevent any claim of full validation.
- SMF-16 must not start until GATE-01..03 are complete and reviewed.

Regenerate the numbers at any time:

```
python3 scripts/build-matrix.py --sync      # matrix from evidence records
python3 scripts/gate-check.py --write       # GATE-01 report (testing/gate/)
```

## 1. Gate status (GATE-01..03)

| Case | What it needs | Status now | Evidence |
|---|---|---|---|
| GATE-01 | Every planned row checked against evidence, persona, fixture, build and tester; unsupported PASS claims rejected | **BLOCKED.** The check is automated and has run on all 328 rows with 0 rejected claims. 169 required rows have no executed outcome, so the review cannot complete. | `evidence/SMF-15/GATE-01.md`, `testing/gate/GATE-01-report.md` |
| GATE-02 | Choose the supported devices and capabilities, with named fallbacks; record exclusions and any reduced-scope decision | **BLOCKED.** No required-row evidence exists to choose from. A proposed workflow with decision criteria and fallbacks is in §5 for Brandon. | `evidence/SMF-15/GATE-02.md` |
| GATE-03 | Confirm packaging, licensing, service prerequisites and access-control findings before SMF-16 | **BLOCKED.** Prerequisites, licences, costs and findings are documented (§6). None is confirmed in an org yet. | `evidence/SMF-15/GATE-03.md` |

## 2. Capability results by environment

Required rows are ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS and
ENV-SFMOBILE-ANDROID; org-level cases use `n/a`. "Suppl." means localhost or emulation, executed
and labelled. Those rows are never host or device evidence.

| Story | Capability | Required rows | Suppl. executed (localhost) | Matrix |
|---|---|---|---|---|
| SMF-1 | Governance, skills, test-plan index | **PASS 3/3** (`n/a`, repository checks; CI on Linux, macOS and Windows) | — | GOV-01..03 |
| SMF-2 | Org readiness (Dev Hub, scratch orgs, Edge Network, MF domain) | BLOCKED 3 | — | ENV-01..03 |
| SMF-3 | Personas, sharing, fixtures | BLOCKED 4, NOT TESTED 4 | — | DATA-01..04 |
| SMF-4 | App launch inside Salesforce | BLOCKED 12 | HOST-01 PASS | HOST-01..03 |
| SMF-5 | Unlocked 2GP install and upgrade | BLOCKED 3 | Package-content check PASS offline (not a matrix row) | PKG-01..03 |
| SMF-6 | Camera and mic capture (camera and mic separately) | BLOCKED 24 | CAP-01..03 PASS (fake devices) | CAP-01..03 |
| SMF-7 | Two-person call (RealtimeKit) | BLOCKED 12 | CALL-03 PASS (client logic) | CALL-01..03 |
| SMF-8 | Screen share | BLOCKED 12 | SHARE-01/03 PASS; SHARE-02 **PARTIAL** (cancel path stubbed only) | SHARE-01..03 |
| SMF-9 | Call recovery | BLOCKED 6 | REC-01..03 PASS (simulated transport) | REC-01..03 |
| SMF-10 | Files upload and authorized read-back | BLOCKED 16 | FILE-01..03 PASS (mock transport) | FILE-01..04 |
| SMF-11 | tldraw markup saved to Files | BLOCKED 16 | MARK-01..03 PASS | MARK-01..04 |
| SMF-12 | Live two-user markup sync | BLOCKED 16 | SYNC-01..03 PASS (loopback) | SYNC-01..04 |
| SMF-13 | 3D viewer | BLOCKED 12 | 3D-01/03 PASS; 3D-02 **FAIL** (software rendering) | 3D-01..03 |
| SMF-14 | 3D delivery and budget | BLOCKED 13 | BUDGET-01/03 PASS; BUDGET-02 **PARTIAL** | BUDGET-01..04 |

Full rows: `testing/MATRIX.md`. Per-story verdicts: `testing/gate/GATE-01-report.md`.

## 3. Expected versus actual

Every expected result is the case text in `testing/test-plan-index.json`, unchanged. No target
was relaxed. For each required row, the actual result is "not executed: prerequisite missing",
and the evidence record names the smallest unblocking action. The supplementary rows recorded
these results, each against a localhost-scoped statement written before the run:

| Case | Expected (localhost-scoped) | Actual | Outcome |
|---|---|---|---|
| CAP-02 (deny path) | Denied capture is reported, retry works | Met with fake devices; a real browser prompt still needs a person (D9) | PASS (suppl.) |
| SHARE-02 | Cancel or unsupported keeps the call; fallback image shown | Headless Chromium left getDisplayMedia pending on the first run; met only with stubs | PARTIAL (suppl.) |
| 3D-02 | Usable within 10 s; median ≥30 fps | 333 ms; **24.4 fps** median (SwiftShader) | FAIL (suppl.); says nothing about devices |
| BUDGET-02 | 5 cycles, orientation and foreground recovery | 5/5 cycles; no resize event logged; backgrounding only simulated | PARTIAL (suppl.) |
| SYNC-01 | ≤2 s propagation on a recorded stable network | 63–65 ms median on loopback; not the stable-network row | PASS (suppl.) |

## 4. Measurements (all supplementary: not device or host measurements)

| Story | Measurement | Value | Conditions |
|---|---|---|---|
| SMF-13 | 3D-02 interactive / median / p5 / p95 fps | 333 ms / 24.4 / 10.6 / 42.9 | Headless Chromium 141, SwiftShader, 4 vCPU container |
| SMF-14 | SMALL vs REP model: open time, median fps | 143–435 ms, 44.1 fps vs 1.26–1.62 s, 3.9 fps | Same; JS heap 34→45 MiB across cycles |
| SMF-12 | Propagation median / p95; reconnect; crash recovery | 63–65 / ≤77 ms; 69–84 ms; 90/90 shapes from SQLite | Loopback, Node build of the sync service |
| SMF-12 | Revocation enforcement | Token expiry: cut 4.8–5.3 s (8 s token, 1 s re-check). Push `/revoke`: cut in under 1 s (Node), 11 ms (Worker under workerd). Without push, the default bound is ≈315 s (not accepted) | Loopback |
| SMF-7 | Service cost | $0.002 per A/V participant-minute (Cloudflare docs, 2026-10-03); ≈$1 estimated for SMF-7..9 testing | Not yet billed |

No scene budget is published (BUDGET-04): the budget logic refuses software-rendered and
localhost input by design.

## 5. Proposed supported workflow (GATE-02, for decision)

This is a proposal for Brandon to accept, amend or reject. It is **not** a validation
result. Each capability is included only if the listed case IDs PASS on the listed rows.
Otherwise the named fallback is the supported behaviour, and the exclusion is recorded.

| Capability | Include if (required rows) | Named fallback if not | Notes |
|---|---|---|---|
| App launch (SMF-4) | HOST-01..03 PASS on all four required rows | No fallback: the whole workflow depends on it | Edge Network and MF domain are prerequisites (SMF-2) |
| Camera/mic capture (SMF-6) | CAP-01..03 PASS per row, camera and mic separately | Per row: photo upload through Files (SMF-10) instead of live capture | Mic and camera may differ by host |
| Two-person call (SMF-7) | CALL-01..03 PASS for desktop↔desktop and desktop↔each phone | Phone + Files photo exchange; call desktop-only where mobile fails | C-SMF7-1 decision needed for "expired" |
| Screen share (SMF-8) | SHARE-01 desktop originate; mobile receive per row | Static diagnostic image in the call (built in) | Mobile **originate** is expected to be unsupported; it is recorded, not assumed |
| Recovery (SMF-9) | REC-01..03 recorded with ≤60 s automatic recovery | Documented manual leave/rejoin | No claim of background capture |
| Files (SMF-10) | FILE-01..04 PASS | None: Files is the system of record | ≤5 MiB images through the Apex path |
| Markup (SMF-11) | MARK-01..04 PASS, with the tldraw licence in place | Annotated image exported as a File (no editable snapshot) | tldraw licence gates production |
| Live markup (SMF-12) | SYNC-01..04 PASS; measured access-change enforcement (`SMF12_AccessSweep` + `/revoke`) meets AC4 | Turn-based markup: save and reopen through SMF-11 | Reviewer judges the measured SYNC-03 access-change times against AC4 |
| 3D view (SMF-13/14) | 3D-01..03 and BUDGET-01..03 PASS; budget published | Static equipment image (built in; fallback trigger in `budget.ts`) | Defer 3D if no device meets 30 fps median |

Devices proposed for the supported set, pending the device rows:
- desktop Google Chrome and Microsoft Edge (current stable, recorded versions);
- the Salesforce mobile app on one recorded iPhone model with iOS 18+;
- the Salesforce mobile app on one recorded Android 12+ model.

Mobile Safari, mobile Chrome, cloud Chromium and localhost stay exploratory or supplementary.

## 6. Packaging, licensing, prerequisites, cost, access control (GATE-03)

### Packaging
- **What the package holds.** The unlocked package `FieldSupportPoC` contains only the app
  shell: the UI bundle, the CustomApplication and `FieldSupport_Access` (ADR-0005).
  `scripts/smf5/check_package.py --built` verifies this offline on the integrated tree.
- **Probe back-ends are not packaged.** The Apex, objects and credentials behind the probes
  live in `probes/` and are deployed per story.
- **Decisions still open:**
  - SMF-16 must decide the production package composition.
  - PKG-01..03 are BLOCKED.
  - C-SMF5-2 (can a beta version be upgraded?) closes on the first PKG-02 run. H9 is the
    irreversible promotion.

### Licences and dependencies
| Item | Licence / terms | Where | Gate |
|---|---|---|---|
| Official Salesforce skills (afv-library 3c15867b) | Metadata disagrees (C-02); installed on demand, not redistributed | `.agents/skills/` (untracked) | Resolved in ADR-0001 rev 2 |
| `@cloudflare/realtimekit` 2.0.2 | Apache-2.0; usage billed per participant-minute | SMF-7..9 | H4 account and token |
| tldraw 5.5.2, `@tldraw/sync(-core)` | tldraw licence; a **production key** must cover the Salesforce domain | SMF-11/12 | H5 |
| three.js 0.186.1 | MIT | SMF-13/14 | — |
| Model fixtures | CC0-1.0, generated in the repo | `testing/fixtures/models/` | — |
| Salesforce file-upload feature 12.9.0 | Salesforce licence | SMF-10 | — |
| Cloudflare Workers + Durable Objects (SQLite) | Cloudflare plan; record the actual plan at first deploy | SMF-12 | H4 |

### External prerequisites (one consolidated list: `docs/cloud/HUMAN-SETUP.md`)
- **H1:** network allowlist, including the Salesforce, Cloudflare (API, RealtimeKit,
  STUN/TURN, workers.dev) and Google Chrome hosts.
- **H2:** Dev Hub auth URL.
- **H3:** consent to enable Dev Hub and packaging.
- **H4:** Cloudflare account and token.
- **H5:** tldraw licence key.
- **H6:** tester mailbox.
- Secrets inside Salesforce and on the Worker are now set by the agent (stages 45 and 49); the former H7/H8 steps are gone (ADR-0004 rev 2).
- **H9:** v1 promotion, only if needed.
- **Org settings:** Salesforce Edge Network and the Multi-Framework domain on each org (SMF-2).

### Access-control findings (to accept, or fix before SMF-16)
| # | Finding | Source | Proposed handling |
|---|---|---|---|
| A1 | RealtimeKit participant tokens outlive a removal of case access unless the participant is deleted | SMF-7 setup doc; assessed in `docs/findings/token-revocation.md` | Enforcement implemented: `SMF7_AccessSweep` deletes participants that fail the issuance rules. CALL-03 access-change runs (join permission and case sharing, separately) record a baseline (expected FAIL), then the enforced result with timing. Live runs pending (BLOCKED). Not accepted. |
| A2 | Live-sync access outlived an access change until token expiry (≈315 s) | SMF-12 SYNC-03; assessed in `docs/findings/token-revocation.md` | Enforcement implemented: `SMF12_AccessSweep` pushes `/revoke`, which closes live sessions and refuses earlier tokens. Verified locally (Node and workerd). SYNC-03 runs for case sharing and permission removal, separately, record the existing connection, the earlier token, and file access with timing: baseline, then enforced. Live runs pending (BLOCKED). The 315 s bound is not accepted. |
| A3 | Was: empty `SMF12_ALLOWED_ORIGINS` allowed any origin | SMF-12 | **Changed:** empty now denies; stage 49 deploys the observed app origin and verifies 101/403/403 with a real token before stage 72. Host verification pending access. |
| A4 | The bundled MF-MODEL-SMALL app asset can be loaded by anyone who can open the app, with no case or Files check | SMF-14 BUDGET-03 | Serve case models only through Files in SMF-16; bundle only non-sensitive demo assets |
| A5 | The Apex read path holds files on the 6 MB heap: 8.25 MiB models fail; 5 MiB images fit narrowly | SMF-10, C-SMF14-01 | Use Connect REST file content for large files; measured at the host run |
| A6 | `MF_AccessBaselineTest` uses `SeeAllData=true` to verify provisioned access | C-06 | Reviewer accepts the exception for this class only |
| A7 | No public-link path exists in any probe; denial paths are covered by Apex tests (not yet run) | SMF-10/11 | Confirm at the first org run |
| A8 | Embedded 3D textures decode through `blob:` URLs; the host CSP may block them | SMF-14 | Observe at the first host run |

### Synthetic data handling
- **Fixtures:** all are synthetic, from `testing/contract.json`. Their hashes are checked by
  `testing/fixtures/generate.py --check` and by the model generator's `verify`.
- **Private mappings:** real persona↔username and record-ID mappings stay in git-ignored
  `private/`.
- **Public content:** `scripts/scan-public-content.py` passes on the integrated tree.

## 7. Unresolved blockers and decisions (owner)

1. **H1 + H2:** these unblock every org-backed row. H3–H9 cover the rest, as in §6.
2. **Physical devices and testers:** `testing/HUMAN-ACTIONS.md` D1–D38. Each row names its
   case, environment rows and the exact interaction.
3. **Owner decisions:**
   - **Contradictions:** C-SMF7-1 (expired-token wording), C-06, C-07, C-08, the C-SMF5-*
     items, and C-SMF14-01.
   - **ADRs to accept:** ADR-0003 (live-sync architecture) and ADR-0004 (vault).
   - **ADR to review:** ADR-0005 (package boundary).
4. **Access findings:** A1–A4, to accept or schedule.

## 8. How to review and merge

The draft PRs are stacked. Merge in dependency order:
1. #1 (SMF-1)
2. #2 (SMF-2)
3. #4 (SMF-3)
4. #3 (SMF-4)
5. The story stacks on top of SMF-4, in any order:
   - #5 (SMF-5);
   - #6 → #7 → #8 and #9 (SMF-6..9);
   - #10 (SMF-13);
   - #11 → #12 → #13 (SMF-10..12);
   - #14 (SMF-14, after #10 and #11).

`claude/smf-15-review` proves the stacks integrate. On it, all checks pass:
- matrix, test plan, public-content scan, skills;
- 67 script unit tests, including the gate-check negatives;
- bundle lint (0 errors), vitest (115/115) and build;
- the package-content check;
- the cloud-spec typecheck (84 tests list).

Done for any story still requires reviewed evidence. Merging is not Done.
