# SMF-7 — RealtimeKit prerequisites, setup and boundary (AC1, AC5)

Sources (retrieved 2026-10-03; the Cloudflare docs site is blocked from this environment, so
the docs were read from the `cloudflare/cloudflare-docs` GitHub repository at commit
`e43015cd`, and the API shapes from `cloudflare/cloudflare-typescript` at `6dbe1fc4`):
`realtime/realtimekit/{quickstart,pricing,network-allowlist,faq,concepts/participant,concepts/preset,core/error-codes}.mdx`,
`src/resources/realtime-kit/{apps,meetings,presets}.ts`, and the published SDK
`@cloudflare/realtimekit@2.0.2` (Apache-2.0).

## What has to exist before any paid use (AC5)

| # | Prerequisite | Who | Notes |
|---|---|---|---|
| P1 | Cloudflare account | Brandon | RealtimeKit is part of Cloudflare Realtime. |
| P2 | API token with **Realtime: Edit** (docs: "Realtime / Realtime Admin") scoped to that account | Brandon | Two uses: the pipeline (env `CF_API_TOKEN`, HUMAN-SETUP H4) and the org (owner step O-SMF7-1). A separate token with only Realtime permission is recommended for the org. |
| P3 | RealtimeKit app + a GROUP_CALL preset allowing audio, video (and screen share for SMF-8) | Agent (stage 45) or Brandon | Stage 45 finds/creates app `smf-field-support-poc`. **Apps created in the dashboard ship default presets; API-created apps may not** — if preset `group_call_host` is missing the stage stops BLOCKED and names the fix (create in dashboard and set `SMF7_RTK_APP_ID`, or create the preset, or set `SMF7_RTK_PRESET`). |
| P4 | Pricing acknowledged | Brandon | Audio/video participant **$0.002 / participant-minute**; audio-only $0.0005; recording/export $0.010 (not used). Meetings and tokens are free; a rejected/expired token is not billed. One 5-minute two-person CALL-01 run ≈ 10 participant-minutes ≈ $0.02; the full SMF-7/8/9 device plan is well under 500 participant-minutes (≈ $1). |
| P5 | Org: Named Credential `SMF7_Cloudflare` → External Credential `SMF7_Cloudflare` (Custom protocol, principal `SMF7_Principal`, header `Authorization: Bearer {!$Credential.SMF7_Cloudflare.ApiToken}`) | Agent (deploy) | In source control without any secret. |
| P6 | **O-SMF7-1 (owner step): set the org-side secret** | Brandon | See below. Never scripted. |
| P7 | Config record `SMF7_RealtimeKit_Config__mdt.Default` (account id, app id, preset) | Agent (stage 45) | Generated into git-ignored `private/smf7-deploy/` and deployed; never committed. |
| P8 | CSP Trusted Sites for the SDK's hosts | Agent (deploy) | `cspTrustedSites/SMF7_RTK_*` (below). |
| P9 | Cloud-environment egress: `api.cloudflare.com`, `*.realtime.cloudflare.com` (already in HUMAN-SETUP H1); for media in the cloud browser also `stun.cloudflare.com`, `turn.cloudflare.com` (UDP/TCP 3478, 5349/443) | Brandon | If the environment proxy cannot pass UDP/TURN, cloud CALL-01/02 media checks fail with an ICE/transport error — a finding, not a pass. |

### O-SMF7-1 — set the Cloudflare token in the org (owner, once per `smf-dev` org)

1. Log in to `smf-dev` as MF-ADMIN (or the scratch-org admin) → **Setup** → Quick Find
   **Named Credentials** → tab **External Credentials** → **SMF7 Cloudflare**.
2. Section **Principals** → row **SMF7_Principal** → **Edit** (or *Add* if the row has no
   parameters) → **Authentication Parameters** → **Add**: Name **`ApiToken`**, Value = the
   Cloudflare API token from P2 → **Save**.
3. Nothing else: permission set `SMF7_Access` already grants principal access.

Detection: stage `45-smf7-realtimekit.sh` reads only the principal's
`authenticationStatus` (Connect REST `/named-credentials/external-credentials/SMF7_Cloudflare`)
and then runs `SMF7_CallAuthService.checkConfiguration()` through the Named Credential. Not
configured → exit 2 `BLOCKED: … O-SMF7-1`; token rejected (HTTP 401/403) → exit 2 with the same
instruction. Scratch orgs are recreated every ≤30 days (stage 20); **repeat O-SMF7-1 after each
recreation** (the stage detects it).

## Server-side boundary (AC1, AC2, CALL-03)

`POST /services/apexrest/smf7/v1/call-token {caseId}` (class `SMF7_CallTokenRestResource`, via
`sdk.fetch` from the bundle):

1. `caseId` must be a Case id; caller needs custom permission `SMF7_Join_Call`.
2. `SELECT Id FROM Case WHERE Id = :caseId WITH USER_MODE` — sharing + CRUD of the caller. No
   row (or no Case access at all, e.g. MF-RESTRICTED) → `403 NO_CASE_ACCESS`, identical for
   "does not exist" and "not shared" (no existence oracle). No provider call happens.
3. Case → meeting mapping in `SMF7_Call_Room__c` (unique `CaseKey__c`), created once via
   `POST …/realtime/kit/{app}/meetings`. One participant per (Case, User) in
   `SMF7_Call_Participant__c`; later requests refresh its token
   (`POST …/participants/{id}/token`), re-adding it if the provider no longer knows it — so a
   rejoin never creates a duplicate participant. `custom_participant_id` is a SHA-256 of
   org+user id (RealtimeKit guidance: no PII).
4. Response: `{success, code, message, authToken, displayName}` with `Cache-Control: no-store`.
   Never the API token, meeting id, participant id, account id or app id. Provider errors →
   `502 PROVIDER_ERROR` with the HTTP status only; bodies are never echoed or logged
   (no `System.debug` in the classes).
5. Users have **no** object permissions on the two SMF7 objects; `SMF7_CallRoomStore` reads them
   in system mode only after step 2 and only with `SMF7_Join_Call`.

**Known limitation (security finding to review):** a RealtimeKit participant token is a JWT
valid for **100 days** and is not tied to the Salesforce session. Removing a user's case access
stops new tokens but does not invalidate a token already issued. Revocation = delete the
participant at RealtimeKit (`DELETE …/participants/{id}`); a production design should do that
on access removal or issue per-session participants. CALL-03 tests a **revoked** token as the
nearest available control for "expired" (see `docs/contradictions.md` C-SMF7-1).

## CSP Trusted Sites (connect-src) — from docs + SDK 2.0.2 source

| Metadata | Host | Why |
|---|---|---|
| SMF7_RTK_Api | api.realtime.cloudflare.com | SDK API |
| SMF7_RTK_Api_Silos | api-silos.realtime.cloudflare.com | SDK logs |
| SMF7_RTK_DA_Collector | da-collector.realtime.cloudflare.com | call statistics |
| SMF7_RTK_Location | location.realtime.cloudflare.com | location for statistics |
| SMF7_RTK_Location_Legacy | location-legacy.realtime.cloudflare.com | present in SDK 2.0.2 source (`servicePrefix`) |
| SMF7_RTK_Socket_Edge | socket-edge.realtime.cloudflare.com | signaling WebSocket (wss) |

Not added: `rtk-assets`/`rtk-uploads` (UI Kit only; the probe uses Core), `r2.cloudflarestorage.com`
(chat only). WebRTC media (STUN/TURN/SFU) is not governed by CSP. To verify on the first
deployed run (host findings, not assumptions): that an `https://` CSP entry also allows the
`wss://` socket in the Salesforce app domain and the mobile container, and that the SDK's
`worker-timers` dependency (Web Worker from a blob URL) is allowed by the host's `worker-src`.

## Client

`@cloudflare/realtimekit@2.0.2` (Core SDK, exact pin, lazily loaded chunk ≈ 650 kB / 158 kB gzip).
The bundle never stores, logs, renders or copies the participant token (`redact()` on every log
line); an invalid/expired token fails once with `TOKEN_REJECTED` and is never retried
automatically. SDK finding from localhost: a malformed JWT is rejected inside the SDK before any
network request; a validly-shaped but tampered/revoked token can only be rejected by the service
(cloud stage 53 checks this).

## Where the metadata lives
All SMF-7 server metadata is in `probes/main/default/` (not packaged; ADR-0005). Stage 45 deploys
it to the target org; stage 40 deploys only the app shell in `force-app/`.
