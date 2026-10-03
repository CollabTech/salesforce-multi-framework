# POC-11 brief — tldraw equipment markup and Salesforce Files save/reopen (SMF-11)

- **Story:** [SMF-11](https://answersllc.atlassian.net/browse/SMF-11) (snapshot `docs/jira-snapshot/2026-10-03/SMF-11.md`) · **Dependency:** SMF-10 (implemented, required rows BLOCKED)
- **Case IDs:** MARK-01, MARK-02, MARK-03, MARK-04
- **Status:** TESTING (implementation in; every required row BLOCKED) · **Capability outcome:** BLOCKED
- **Selected skills:** project `smf-story-workflow`, `smf-evidence`, `smf-capability-probe`, `smf-salesforce-boundaries`, `smf-physical-mobile-testing`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate`, `experience-ui-bundle-salesforce-data-access`, `experience-ui-bundle-file-upload-generate`, `platform-apex-generate`, `platform-apex-test-generate`, `platform-permission-set-generate`, `dx-code-analyzer-run`

## Question
Can TECH and SUPPORT annotate the authorized case image with tldraw (mouse and touch), save
an editable snapshot plus an annotated export to Salesforce Files with explicit version
association, reopen it from a fresh session without browser-local state, survive failed and
concurrent saves without silent loss, and keep RESTRICTED out?

## Design
| Concern | Mechanism |
|---|---|
| Editor | `tldraw@5.5.2` (exact pin), route `/probes/markup` (lazy-loaded chunk). No `persistenceKey` → no IndexedDB/localStorage document. |
| Image asset | Referenced, never embedded: asset `src = asset:sfcv/<ContentVersion Id>`; a custom `TLAssetStore.resolve` downloads it through the SMF-10 Apex endpoint **as the signed-in user** (denied → not rendered). Upload into the canvas is disabled. Snapshots are checked to contain no `data:`/`blob:` URLs. |
| Save | `getSnapshot(editor.store).document` (JSON) + `editor.toImage(..., {format:'png'})`. Bytes via the official `upload()` API; commit via Apex REST `SMF11_MarkupResource` (`POST /smf11/v1/cases/{id}/markup`). |
| Version association (chosen mechanism) | Each save creates **two new Files** linked to the case by `FirstPublishLocationId` (→ ContentDocumentLink): `MF-MARKUP-001 snapshot r<n>` and `MF-MARKUP-001 export r<n>`. Descriptions: `smf11;kind=snapshot;rev=n;save=<key>;image=<CV>;base=<previous snapshot CV>` and `smf11;kind=export;rev=n;save=<key>;snapshot=<snapshot CV>`. Justification: every revision stays immutable and retrievable (MARK-03 "preserve existing versions"); works whichever persona saved last (adding a *version* to an existing ContentDocument needs owner/collaborator rights on it, which SUPPORT may not have on TECH's File); the export→snapshot→image chain is explicit and queryable. Alternative not chosen: new ContentVersions of one ContentDocument (`ContentDocumentId` + `ReasonForChange`). |
| Conflicts | Apex locks the Case row (`FOR UPDATE`), reads the latest revision, and returns **409** with the current revision when the caller's base is stale — nothing is written. UI offers "Load latest (discard mine)" or "Save mine as a new revision on top" (explicit, prior revisions preserved). |
| Failed save / retry | Save key (UUID) per save; uploaded bodies cached per key; Apex returns the existing revision for an already-committed key (no duplicate). |
| Denial (MARK-04) | Apex `with sharing` + `USER_MODE`; snapshot/export/image retrieval through SMF-10's endpoint; `SMF11_Access` grants only the class (assign to all three personas). |
| Licensing (AC5) | tldraw SDK requires a license key in production (HTTPS + non-loopback host + production build — i.e. inside Salesforce); without it the editor stops rendering after ~5 s. Keys are domain-bound: the key must cover the host serving the UI bundle (Salesforce/scratch-org domains — confirm on first deploy). Key read at build from `VITE_TLDRAW_LICENSE_KEY`; cloud stage 45 maps the owner's `TLDRAW_LICENSE_KEY` env var to it and redeploys. The probe shows `gate: not-required | key-present | BLOCKED-no-key`. Production use is gated on an appropriate license (trial = 100 days; commercial for production). |
| Asset hosting (AC5) | Fonts/icons/translations self-hosted via `@tldraw/assets@5.5.2` `getAssetUrlsByImport` (`imports.vite`) — bundled into the UI bundle; no CDN, no CSP Trusted Site needed. Localhost e2e asserts zero non-localhost requests. |

## Test plan per case ID
| Case | Personas | Fixtures | Rows | Script | Expected |
|---|---|---|---|---|---|
| MARK-01 | TECH (circle), SUPPORT (arrow + text) | MF-IMAGE-001, MF-MARKUP-001 | Chrome, Edge, SF iOS, SF Android | `docs/test-scripts/SMF-11-MARKUP.md` §MARK-01 | Mouse and mobile touch create the prescribed circle, arrow and label; pan/zoom and readable annotation positioning. |
| MARK-02 | TECH saves; SUPPORT reopens fresh | MF-IMAGE-001, MF-MARKUP-001 | same | §MARK-02 | Image and all annotations persist without browser-local state. |
| MARK-03 | TECH + SUPPORT | MF-MARKUP-001 | same | §MARK-03 | Failed save/retry and concurrent versions preserve versions or show an explicit conflict. |
| MARK-04 | RESTRICTED | image, snapshot, export | same | §MARK-04 | Restricted users cannot retrieve the image, snapshot or export. |

## Cloud execution (after H1/H2/H5)
Stage `45-smf11-tldraw-license.sh` (rebuild with key, redeploy bundle; BLOCKED without
`TLDRAW_LICENSE_KEY`), `46` (permission sets + Apex tests), `53-smf11-markup-e2e.sh` →
`testing/cloud-e2e/tests/smf-11-markup.spec.ts` (MARK-01 mouse, MARK-02, MARK-03, MARK-04 as
real personas in Edge/Chromium). Touch on physical Salesforce mobile is human-only.

## Prerequisites and blockers
| Case | Gap | Smallest unblocking action |
|---|---|---|
| MARK-01..04 | SMF-2 ENV-01..03 BLOCKED (no org credential; Salesforce egress denied); SMF-3/SMF-4/SMF-10 not verified in an org | Owner H1 + H2, then `pipeline.sh 20 30 40 45 46 52 53` |
| MARK-01..03 host rows | No tldraw license key | Owner H5: `TLDRAW_LICENSE_KEY` covering the Salesforce host(s) |
| MARK-01 touch, MARK-02 mobile | No physical devices | Device tester: HUMAN-ACTIONS rows (SMF-11) |
| Apex | Cannot run here | Stage 46 runs `SMF11_*Test` in smf-dev |
| Assumption | `ContentBodyId` settable from Apex on insert (set dynamically) — verify on first deploy; fallback: create the two ContentVersions via UI API `createRecord` after an Apex reservation | Stage 46/53 result |

## Static analysis
Code Analyzer (Recommended) on SMF11 classes: 0 sev1–2; 27 sev3–4 (test-method naming per the
official test skill, complexity of `save`/`findLatest`, ApexDoc gaps, parameter count).

## Results
Required rows BLOCKED (`evidence/SMF-11/MARK-0n.md`); localhost exploratory
`evidence/SMF-11/MARK-0{1,2,3}-ENV-EMULATION-LOCALHOST.md`.
