# Token revocation findings, assessed against the agreed criteria

**Status: open.** This document reports the findings against the criteria. The owner has not
accepted any limitation (owner message, 2026-10-04). No outcome here is measured yet: every
required row is still BLOCKED by missing access. The "expected outcome" column says what the
current design should produce against the unchanged criterion. It is not a result.

## A1: RealtimeKit participant tokens outlive an access change (SMF-7)

| | |
|---|---|
| Criteria | **SMF-7 AC2:** "Verify authorized room membership and deny unauthorized room access; test invalid or expired participant authorization." **CALL-03:** "RESTRICTED and wrong-case users cannot obtain/join the room; expired/invalid authorization is rejected without leaking credentials." |
| Design fact | Apex issues a participant token only after the case-access check (`UserRecordAccess`) and `SMF7_Join_Call`. The token is a RealtimeKit JWT valid for 100 days and not bound to the Salesforce session (`docs/smf-7/realtimekit-setup.md`). Removing a user's access stops **new** tokens, but a token already issued keeps working until the participant is deleted at RealtimeKit. |
| Existing tests (kept) | Invalid token, tampered token, revoked participant (stand-in for "expired", C-SMF7-1), RESTRICTED and wrong-case denial (`smf-7-call.spec.ts`). |
| Added tests | `CALL-03 access change, {join-permission, case-sharing}, {baseline, enforced}` (`smf-7-call.spec.ts`). MF-SUPPORT holds one live connection, and a second session that has joined and left keeps its issued token. Then either `SMF7_Access` is unassigned or the SMF-3 manual `CaseShare` on MF-CASE-001 is deleted (two separate runs). For up to 6 min each run records: whether, and after how many seconds, **(a)** the existing connection is cut and **(b)** a new join with the earlier token is rejected. Both assertions are the criterion; neither is relaxed. Access is restored afterwards. |
| Baseline (enforcement off) | Expected **FAIL**: the earlier token keeps joining and the connection stays up for the whole window. To be recorded live first, before enforcement is enabled. **Not yet run**: BLOCKED (network/Dev Hub, `evidence/SMF-2/logs/readiness-2026-10-04.txt`). |
| Enforcement (implemented, unverified live) | `SMF7_AccessSweep` (Schedulable + Queueable, callouts) re-checks every mapped participant against the issuance rules: active user, `SMF7_Join_Call` custom permission, and case read access via `UserRecordAccess`. It deletes each participant that fails at RealtimeKit (`DELETE …/meetings/{m}/participants/{p}`, 404 treated as already gone), which invalidates that participant's token and ends its session. Then it removes the mapping. A provider error keeps the mapping, so the next run retries. `SMF7_AccessSweep.start(1)` schedules one run per minute; `stop()` removes it. Apex tests `SMF7_AccessSweepTest` cover 7 cases (kept, permission removed, case share removed, user deactivated, provider 500, not configured, start/stop), run offline in the org only, so **not yet executed**. Expected bound: about 60 s plus queue latency. The measured time is the result. |
| Remaining limits | Enforcement depends on the scheduled sweep running, so timing is bounded by the interval, not immediate. An event-driven trigger is not possible: CaseShare and PermissionSetAssignment deletions fire no Apex triggers. Whether a bound of about 1 min meets AC2 is for the reviewer to judge from the measured times. |

## A2: Live-sync access after an access change (SMF-12)

| | |
|---|---|
| Criteria | **SMF-12 AC4:** "Deny unauthorized room joins and file access, including after access changes." **SYNC-03:** "Deny restricted/wrong-case room and asset access; test revoked access and document the actual enforcement timing." |
| Design fact | A room token is minted by Apex after the case-access check. Its lifetime is 300 s, and the Durable Object re-checks expiry every 15 s. **Without enforcement**, revoked access therefore ends a live session only after up to about 315 s. That bound is not accepted (owner, 2026-10-04), so enforcement was added below. Images are fetched per user from Files, so access to the image itself is enforced immediately. |
| Localhost measurement (supplementary, loopback) | With an 8 s token and 1 s re-check, the session was cut 4.8–5.3 s after revocation. This exercises the mechanism only; it is not the host timing. |
| Existing tests (kept) | SYNC-03 cloud spec: RESTRICTED and wrong-case joins denied. The earlier `SMF12_Access` removal while connected is now the `join-permission` access-change run. |
| Gap in the earlier test (closed) | Unassigning the permission set only stood in for an access change; removing **case access** (sharing) is the change the criterion names. Both are now tested, separately. |
| Added tests | `SYNC-03 access change, {case-sharing, join-permission}, {baseline, enforced}` (`smf-12-sync.spec.ts`). MF-SUPPORT holds a live session in the MF-CASE-001 room and a token issued earlier through Apex. Then the SMF-3 manual `CaseShare` is deleted, or `SMF12_Access` is unassigned. For up to 7 min each run records, timed from the change: **(a)** existing connection, i.e. when it leaves "synced (online)" and when its reconnect is refused a new token; **(b)** new join with the earlier token (`services/markup-sync/test/token-join.mjs`, with the real app origin), i.e. when it is refused and with which HTTP status; **(c)** file access, i.e. when MF-IMAGE-001 stops being readable by MF-SUPPORT (record query and `VersionData` download as that persona; case-sharing run only). Every assertion is the criterion. Access is restored afterwards. |
| Baseline (enforcement off) | Expected: (a) and (b) end only when the token expires, about 300 s plus up to 15 s; (c) is immediate, because Files access follows case sharing. **Not yet run**: BLOCKED (network/Dev Hub). |
| Enforcement (implemented; service verified locally, org side unverified) | (1) Apex records each holder of an unexpired token (`SMF12_Room_Grant__c`, written by `SMF12_RoomGrantStore` on mint; no token stored). (2) `SMF12_AccessSweep` re-checks holders every minute against the issuance rules: active user, Apex access to `SMF12_RoomTokenResource`, and case **edit** access via `UserRecordAccess`. (3) For a holder who fails, it calls `POST /revoke {userId, caseId}` through `SMF12_MarkupSync` (mint-key authenticated). (4) The service closes that user's sessions in the case room at once (close code 4003) and refuses every token for (user, room) issued at or before the revocation; the Worker keeps this durably in Durable Object storage. A token minted after access is restored is accepted. **Local verification:** Node server, vitest 12/12, live session cut by `/revoke` in under 1 s; Worker under `wrangler dev --local` (workerd), `worker-smoke.mjs` passed: cut after 11 ms with code 4003, earlier token 401, token minted after the revocation 101, bad key 401. Apex tests `SMF12_AccessSweepTest` (8) run only in the org: **not yet executed**. Expected bound: about 60 s plus queue latency. The measured time is the result. |
| Remaining limits | Enforcement depends on the scheduled sweep (interval bound), because CaseShare and PermissionSetAssignment deletions fire no Apex triggers. If the service is unreachable, the grant is kept and retried next run, so the token TTL remains the backstop. |

## A3: Origin allowlist (SMF-12). Fixed in this change, verification pending a host run
- **Before:** an empty `SMF12_ALLOWED_ORIGINS` allowed any origin.
- **Now:** both the Worker and the Node server **deny** when the list is empty. Only the
  loopback tests set `SMF12_ALLOW_ANY_ORIGIN=1`.
- **Stage 49 now does the following before stage 72 may run:**
  1. Observes the origin the probe actually runs on, as MF-TECH in the real host.
  2. Deploys the Worker with exactly that origin.
  3. Confirms `/health` reports one allowed origin and allow-any off.
  4. Proves enforcement with a real Apex-issued token: allowed origin → 101, other origin → 403,
     no Origin → 403.
- **Local proof:** the same check (`services/markup-sync/test/origin-check.mjs`) passed against
  the Node build: 101 / 403 / 403. When the allowlist was set to a different origin, the
  check failed as it should.
