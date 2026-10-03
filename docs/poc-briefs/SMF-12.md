# POC-12 brief — Two-user live tldraw collaboration with durable recovery (SMF-12)

- **Story:** [SMF-12](https://answersllc.atlassian.net/browse/SMF-12) (snapshot `docs/jira-snapshot/2026-10-03/SMF-12.md`) · **Dependency:** SMF-11 (implemented; required rows BLOCKED)
- **Case IDs:** SYNC-01, SYNC-02, SYNC-03, SYNC-04
- **Status:** TESTING (implementation in; every required row BLOCKED) · **Capability outcome:** BLOCKED
- **Decision:** [ADR-0003](../adr/0003-markup-live-sync.md)
- **Selected skills:** project `smf-story-workflow`, `smf-evidence`, `smf-capability-probe`, `smf-salesforce-boundaries`, `smf-physical-mobile-testing`, `smf-public-provenance`; official `experience-ui-bundle-frontend-generate`, `experience-ui-bundle-salesforce-data-access`, `experience-ui-bundle-metadata-generate` (CSP Trusted Site), `platform-apex-generate`, `platform-apex-test-generate`, `platform-permission-set-generate`, `dx-code-analyzer-run`

## Question
Can TECH and SUPPORT mark up the same case image live (edits + presence ≤ 2 s on a recorded
stable network), recover from disconnects and service restarts, keep RESTRICTED and other
cases out (including after access changes), and end with a correctly associated Salesforce
snapshot/version — desktop and physical mobile?

## Components
| Part | Where |
|---|---|
| Sync service (Node 22, SQLite per room) | `services/markup-sync/src/node/server.ts` |
| Sync service (Cloudflare Worker + SQLite Durable Object) | `services/markup-sync/src/worker/worker.ts`, `wrangler.toml` |
| Token format / mint / verify (shared) | `services/markup-sync/src/shared/token.ts` |
| Apex token broker | `probes/main/default/classes/SMF12_RoomToken{Service,Resource}.cls` (+ test) |
| Credentials / CSP / access | `probes/main/default/{externalCredentials,namedCredentials,cspTrustedSites}/SMF12_*`, `permissionsets/SMF12_Access` |
| Probe UI | `/probes/markup-sync` (`src/probes/markup-sync/`), `@tldraw/sync@5.5.2` |
| Cloud stages | `49-smf12-sync-deploy.sh` (Worker + metadata + grants + Apex tests + token check), `72-smf12-sync-e2e.sh` |

## Owner secret steps (scripts never write secrets)
| Step | Secret | Where | Detected by stage 49 |
|---|---|---|---|
| S1 | `SMF12_ROOM_TOKEN_SECRET` (≥ 32 random chars) | Cloudflare Worker `smf-markup-sync`: `npx wrangler secret put SMF12_ROOM_TOKEN_SECRET` in `services/markup-sync` (or Dashboard → Workers → smf-markup-sync → Settings → Variables and Secrets) | `GET /health` → `secretConfigured:false` ⇒ **BLOCKED** |
| S2 | the same value as **MintKey** | smf-dev Setup → Named Credentials → External Credentials → `SMF12_MarkupSync` → Principals → `SMF12Mint` → Authentication Parameters → add `MintKey` | MF-TECH token request answered "refused the request (401)" ⇒ **BLOCKED** |
Prerequisites: H1 (egress incl. `*.workers.dev`, `api.cloudflare.com`), H2 (Dev Hub), H4 (`CF_API_TOKEN` with Workers Scripts: Edit, `CF_ACCOUNT_ID`), H5 (`TLDRAW_LICENSE_KEY`, stage 48).

## Hosting options
1. **Cloudflare Workers** (stage 49; Durable Objects with SQLite; `workers.dev` origin) — blocked
   here by egress until H1/H4.
2. **Any Node 22 host with TLS** (container/VM; `npm ci && npm run build && npm start` with
   `SMF12_ROOM_TOKEN_SECRET`, `SMF12_DATA_DIR` on a persistent volume, `SMF12_PUBLIC_WS_URL=wss://…`);
   update the Named Credential URL and CSP Trusted Site to its origin.
3. Not acceptable: tldraw demo server / public rooms (AC4).

## Test plan per case ID
| Case | Personas | Fixtures | Rows | Script | Expected |
|---|---|---|---|---|---|
| SYNC-01 | TECH + SUPPORT | MF-ROOM-001, MF-MARKUP-001, MF-IMAGE-001 | Chrome, Edge, SF iOS, SF Android | `docs/test-scripts/SMF-12-SYNC.md` §SYNC-01 | Both sessions converge and show presence; propagation ≤ 2 s on a recorded stable network |
| SYNC-02 | TECH + SUPPORT | same | same | §SYNC-02 | Concurrent edits, disconnect/reconnect, service restart: agreed state/assets recover |
| SYNC-03 | RESTRICTED; TECH (wrong case) | MF-ROOM-002 / MF-CASE-002 | same | §SYNC-03 | Restricted/wrong-case room and asset access denied; revoked access enforced; timing documented |
| SYNC-04 | desktop ↔ physical mobile pairs | MF-MARKUP-001 Files | desktop + SF iOS/Android | §SYNC-04 | Pairs work; final Salesforce snapshot/version association correct |

## Localhost measurements (ENV-EMULATION-LOCALHOST only — loopback, not a host or network claim)
3 consecutive runs, 2 headless Chromium contexts, Node sync server on 127.0.0.1:
propagation over 2 × 30 programmatic edits — median 63–65 ms, p95 72–77 ms, max ≤ 95 ms;
reconnect convergence 69–84 ms after network restored; SIGKILL + restart: fresh client saw all
90 shapes; revocation with TTL 8 s / re-check 1 s: live session cut 6.8–7.3 s after join (≤ TTL
+ re-check), no reconnect. Worker build under `wrangler dev --local` (workerd): health, mint-key
guard, valid/no/wrong-room/expired token checks all as expected.

## Prerequisites and blockers
| Case | Gap | Smallest unblocking action |
|---|---|---|
| SYNC-01..04 | SMF-2 ENV-01..03 BLOCKED; SMF-3/4/10/11 not verified in an org | Owner H1 + H2 → `pipeline.sh 20 30 40 46 48 49 72` |
| SYNC-01..04 | No hosted service (Cloudflare egress blocked; no CF token) | Owner H1 (`api.cloudflare.com`, `*.workers.dev`) + H4, then S1 + S2 |
| SYNC-04 + mobile rows | No physical devices | Device tester (HUMAN-ACTIONS F-rows) |
| Assumption | Apex REST missing-class/permission responses are platform error lists (shown as NOT CONFIGURED) | Observe on first deploy |

## Licensing / cost
tldraw SDK license (H5) also covers the sync client; `@tldraw/sync-core` is under the tldraw
license. Cloudflare Workers + Durable Objects (SQLite) usage at PoC scale fits the paid Workers
plan minimum; record actual plan when deployed.

## Results
Required rows BLOCKED (`evidence/SMF-12/SYNC-0n.md`); localhost exploratory
`evidence/SMF-12/SYNC-0{1,2,3}-ENV-EMULATION-LOCALHOST.md`.
