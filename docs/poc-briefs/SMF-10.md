# POC-10 brief — Authorized equipment-image upload and retrieval through Salesforce Files (SMF-10)

- **Story:** [SMF-10](https://answersllc.atlassian.net/browse/SMF-10) (snapshot `docs/jira-snapshot/2026-10-03/SMF-10.md`) · **Dependencies:** SMF-3 (personas/fixtures), SMF-4 (deployed app) — neither verified in an org
- **Case IDs:** FILE-01, FILE-02, FILE-03, FILE-04
- **Status:** TESTING (implementation in; every required row BLOCKED) · **Capability outcome:** BLOCKED
- **Selected skills:** project `smf-story-workflow`, `smf-evidence`, `smf-capability-probe`, `smf-salesforce-boundaries`, `smf-physical-mobile-testing`, `smf-public-provenance`; official `experience-ui-bundle-file-upload-generate`, `experience-ui-bundle-salesforce-data-access`, `experience-ui-bundle-frontend-generate`, `platform-apex-generate`, `platform-apex-test-generate`, `platform-permission-set-generate`, `dx-code-analyzer-run`

## Question this probe answers
Can MF-TECH attach a synthetic equipment image to MF-CASE-001 as a Salesforce File through
supported APIs, can MF-SUPPORT read it from a fresh session, and are MF-RESTRICTED and the
MF-FILE-DENIED negative control denied — on desktop and in the physical Salesforce mobile app?

## Bounded scope
In: one probe route (`/probes/files`), image validation, upload/link, user-context read-back,
retrieval by ContentVersion Id, cancel/failure/retry with duplicate prevention, masked
evidence block. Out: markup (SMF-11), sync (SMF-12), 3D assets (SMF-14), fixture seeding (SMF-3).

## Design
| Concern | Mechanism |
|---|---|
| Upload bytes | Official `@salesforce/ui-bundle-template-feature-react-file-upload@12.9.0` `upload()` (Pattern A, no `recordId`) — no hand-built FormData/XHR |
| Link to the case | UI API `createRecord('ContentVersion', {FirstPublishLocationId: case, Title, PathOnClient, ContentBodyId, Description})` from `@salesforce/ui-bundle/api` — the same call the package's `createContentVersion()` makes, plus the standard `Description` field. `FirstPublishLocationId` makes Salesforce create the **ContentDocumentLink** to the case. |
| Read-back / retrieval | Apex REST `SMF10_CaseFilesResource` (`/services/apexrest/smf10/v1/...`) via `sdk.fetch`, `with sharing` + `WITH USER_MODE`: lists the case's ContentDocumentLinks with latest versions, and streams one version's bytes. Runs as the signed-in user, so a 404 is a real denial. (Enterprise `/query` and `/sobjects/.../VersionData` are not on the data-access skill's supported-API allowlist.) |
| No public-link workaround | Probe never creates ContentDistribution; read-back reports the count of distributions the caller can see (`null` = cannot tell); unit test greps the probe source; the device script has an MF-ADMIN query for ContentDistribution = 0. |
| Local vs persisted | Dashed "Browser-local preview — NOT persisted" panel from `URL.createObjectURL(file)`; green "Persisted Salesforce File" panel only after a server read-back: masked ContentDocument/ContentVersion Ids, version number, link-to-case check, SHA-256 of local vs read-back bytes. |
| Idempotent retry | Client UUID per *selection*, written as `smf10:key=<uuid>` in `Description`. Before writing and after any link error, the flow reads the case's Files and looks for the key; if found it only verifies. A ContentBody uploaded by a failed attempt is reused. A new selection = new key (intended second upload). Limitation: check-then-write is not atomic across two tabs retrying the same key simultaneously. |
| Validation | Fixed policy: PNG/JPEG only, ≤ 5 MiB (5,242,880 bytes accepted, +1 rejected); extension, MIME and magic bytes must agree (a renamed .txt is rejected). HEIC is rejected unless the host transcodes it — a FILE-04 observation to record. |
| Access | Permission set `SMF10_Access` grants only the Apex class; assign to TECH, SUPPORT **and** RESTRICTED so denial comes from sharing, not class access. |

Public interface for other tracks: `src/probes/files/lib/index.ts` (policy/validation,
`FilesTransport` with `listCaseFiles`/`uploadBody`/`createVersion`/`fetchVersionData`,
`selectFilesTransport`, `runUpload`, `maskId`, errors).

## Test plan per case ID
| Case | Personas | Fixtures | Rows | Steps | Expected | Stop |
|---|---|---|---|---|---|---|
| FILE-01 | TECH uploads; SUPPORT reads (fresh session) | MF-CASE-001, MF-IMAGE-001 | Chrome, Edge, SF iOS, SF Android | `docs/test-scripts/SMF-10-FILES.md` §FILE-01 | Upload the valid image, verify its correct record link, then read it as SUPPORT from a fresh session. | SMF-3/SMF-4 not verified |
| FILE-02 | RESTRICTED; TECH, SUPPORT | MF-IMAGE-001, MF-FILE-DENIED, MF-CASE-002 | same | §FILE-02 | RESTRICTED cannot retrieve it; TECH/SUPPORT cannot retrieve the negative-control File; no public-link workaround. | same |
| FILE-03 | TECH | MF-UPLOAD-INVALID, MF-IMAGE-001 | same | §FILE-03 | Reject .txt and >5 MiB images cleanly; cancel/failure/retry; no unintended duplicates. | same |
| FILE-04 | TECH, SUPPORT | as FILE-01 | SF iOS, SF Android + desktop | §FILE-04 | Supported upload/view flow repeated on physical Salesforce mobile iOS/Android and desktop. | no device |

## Prerequisites and blockers
| Case | Gap | Smallest unblocking action |
|---|---|---|
| FILE-01..04 | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied | Allow Salesforce egress + provide Dev Hub/dev-org auth (SMF-2 setup-path), or run on a contributor machine |
| FILE-01..04 | SMF-3 personas/fixtures (MF-TECH/SUPPORT/RESTRICTED, MF-CASE-001/002, MF-IMAGE-001, MF-FILE-DENIED, MF-UPLOAD-INVALID) not provisioned/verified | Complete SMF-3 DATA-01..03 in `smf-dev` |
| FILE-01..04 | SMF-4 app not deployed | Deploy per `docs/smf-4/deploy.md` + this story's classes/permission set (test script §0) |
| FILE-04 | No physical iOS/Android device | Brandon: run §FILE-04 on an iPhone and an Android phone in the Salesforce app |
| Apex | Apex tests cannot run here | Run `sf apex run test --class-names SMF10_CaseFilesServiceTest SMF10_CaseFilesResourceTest --target-org smf-dev` |

## Cloud execution (after owner setup H1/H2)
`scripts/cloud/stages/46-smf10-files-access.sh` assigns `SMF10_Access` (and `SMF11_Access`)
to the three personas and runs the SMF-10/11 Apex tests in `smf-dev`;
`52-smf10-files-e2e.sh` runs `testing/cloud-e2e/tests/smf-10-files.spec.ts` as the real
personas (FILE-01 TECH→SUPPORT fresh context, FILE-02 three denials + admin
ContentDistribution count, FILE-03 rejections, CDP-throttled cancel, offline failure, retry,
+2 Files check) in ENV-DESKTOP-EDGE and ENV-CLOUD-CHROMIUM. Physical mobile rows (FILE-04)
stay human. Record Ids come from `private/fixtures.json` (MF-CASE-001 falls back to an admin
query on the SMF-3 subject); fixture assets from `testing/fixtures/MF-*` (SMF-3).

## Static analysis
`sf code-analyzer run --rule-selector Recommended` on the SMF-10 classes: 0 sev1–2; 22
sev3–4 remaining — test-method names with `_` (the official `platform-apex-test-generate`
naming convention conflicts with PMD MethodNamingConventions), `doGet` cyclomatic complexity
10, 4 input-validation tests without `System.runAs`.

## Licensing / cost
No new licences. Feature package is Salesforce-published (`SEE LICENSE IN LICENSE.txt`).

## Results
Required rows: all BLOCKED (`evidence/SMF-10/FILE-0n.md`). Localhost exploratory (mock
transport): `evidence/SMF-10/FILE-0{1,2,3}-ENV-EMULATION-LOCALHOST.md`.
