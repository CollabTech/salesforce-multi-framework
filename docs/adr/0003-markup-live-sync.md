# ADR-0003: Live markup sync — authenticated self-hosted tldraw sync; Salesforce Files is durable storage only

- **Status:** Proposed (implemented on `claude/smf-12-sync`; host evidence pending)
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-12 (SYNC-01..04); builds on SMF-10 (Files) and SMF-11 (markup revisions)
- **Deciders:** implementing agent; project owner to accept

## Context
SMF-12 AC1: "Use an authenticated collaboration service; Salesforce Files is durable
image/snapshot storage, not an assumed real-time synchronization transport." AC4: deny
unauthorized room joins and file access, including after access changes; never use a public
demo room. Salesforce is the source of truth for who may see a case (`smf-salesforce-boundaries`).
tldraw 5.5.2 ships `@tldraw/sync-core` (`TLSocketRoom`, SQLite storage) and `@tldraw/sync`
(`useSync`, token-refreshing `uri` callback).

## Options considered
1. **tldraw demo server (`useSyncDemo`)** — public rooms; forbidden by AC4.
2. **Salesforce Files / Platform Events as transport** — not a real-time transport (AC1); no
   presence; API limits.
3. **Authenticated self-hosted `@tldraw/sync-core` server** — chosen. Same protocol runs as a
   Node 22 process (SQLite file per room) or a Cloudflare Worker + SQLite Durable Object (the
   tldraw sync-cloudflare template's persistence design).
4. **Commercial hosted sync (e.g. tldraw-hosted / Liveblocks)** — extra vendor, data residency
   review; not needed to answer the PoC question.

## Decision
- **Live state:** `services/markup-sync` (`@tldraw/sync-core` 5.5.2 pinned to the client's
  tldraw 5.5.2). Rooms are derived from the case (`mf-` + SHA-256(case Id)[0..16]); one room per case.
- **Authorization:** a short-lived HMAC-SHA256 room token binds *(Salesforce user Id, case Id,
  room, expiry ≤ 900 s, default 300 s)*. Apex `SMF12_RoomTokenService` (with sharing) mints
  only after the caller can see the case (`WITH USER_MODE`) **and** has edit access
  (`UserRecordAccess.HasEditAccess`); it calls the service's `/mint` through Named Credential
  `SMF12_MarkupSync`, whose External Credential sends the mint key as `X-SMF-Mint-Key`. The
  signing secret (`SMF12_ROOM_TOKEN_SECRET`) exists only on the service and, as the mint key,
  in the External Credential principal — both set by the owner, never in the repository.
- **Enforcement:** the service verifies signature, expiry and room on WebSocket connect and
  re-checks every `SMF12_RECHECK_MS` (15 s); expired sessions are closed (non-fatal close, so an
  authorized client re-mints through Apex on reconnect; a user whose access was removed cannot).
  Worst-case revocation delay = token TTL + re-check interval (≈ 315 s with defaults).
- **Assets:** the image is referenced as `asset:sfcv/<ContentVersion Id>`; every client resolves
  it through the SMF-10 Apex endpoint *as itself*. No image bytes pass through or are stored by
  the sync service, so Files access control stays in Salesforce.
- **Durable record:** the agreed markup is saved to Salesforce Files via SMF-11 revisions
  (snapshot + export, row-locked conflict detection). The sync service's SQLite is operational
  state (recovery), not the record.
- **Packaging:** all SMF-12 server metadata lives in the non-packaged `probes/` directory.

## Consequences
- Requires hosting (Workers or any Node 22 host with TLS), a CSP Trusted Site for the service
  origin, and two owner secret steps (S1 service secret, S2 External Credential MintKey).
- Revocation is not instantaneous: a removed user keeps an open session until their token
  expires (≤ TTL + re-check). Shorter TTL trades for more Apex mint calls.
- Conflict resolution inside a live room is tldraw's record-level last-writer-wins; concurrent
  saves to Files get an explicit SMF-11 conflict.
- Revisit if a managed sync offering with Salesforce-identity integration becomes preferable,
  or if TTL/re-check targets are set by the owner.
