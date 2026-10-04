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
| Added test | `CALL-03 access removed after a token was issued`: TECH joins and leaves, `SMF7_Access` is unassigned, and the client rejoins with the earlier token. The assertion is the criterion: the token must not join. |
| Expected outcome with the current design | **FAIL** for that check: the earlier token joins. CALL-03 overall is then FAIL or PARTIAL, decided by the reviewer from the recorded rows. The criterion is not relaxed. |
| Smallest fix that would meet the criterion | Delete the user's RealtimeKit participants when case or permission access is removed. This needs Apex on the access change plus the provider delete call the stage already uses (`smf7_realtimekit.py revoke`). Alternatively, issue a new participant per session and delete it on leave or timeout. Not implemented; it needs an owner decision on scope. |

## A2: Live-sync access continues after an access change, up to the token lifetime plus the re-check interval (SMF-12)

| | |
|---|---|
| Criteria | **SMF-12 AC4:** "Deny unauthorized room joins and file access, including after access changes." **SYNC-03:** "Deny restricted/wrong-case room and asset access; test revoked access and document the actual enforcement timing." |
| Design fact | A room token is minted by Apex after the case-access check. Its lifetime is 300 s, and the Durable Object re-checks expiry every 15 s, so revoked access ends a live session within about 315 s. Images are fetched per user from Files, so access to the image itself is enforced immediately. |
| Localhost measurement (supplementary, loopback) | With an 8 s token and 1 s re-check, the session was cut 4.8–5.3 s after revocation. This exercises the mechanism only; it is not the host timing. |
| Existing test (kept) | SYNC-03 cloud spec: RESTRICTED and wrong-case denied. It removes SUPPORT's `SMF12_Access` while connected and records the cut time. |
| Gap in the existing test | Unassigning the permission set stands in for an access change. Removing **case access** (sharing) is the change the criterion names. The cut time should be recorded for both. |
| Expected outcome with the current design | SYNC-03 asks for the actual enforcement timing to be documented, so the measured time is the result. AC4 says "including after access changes" but sets no timing. Whether a cut within about 315 s satisfies "deny … after access changes" is a **criterion interpretation for the owner**. Until then the reviewer should record SYNC-03's access-change row as **PARTIAL**, giving the measured time. |
| Options (not implemented) | Shorter token lifetime and re-check interval, which costs more Apex calls. Or push revocation: Apex calls a Worker `/revoke` endpoint on access change. |

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
