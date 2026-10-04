/**
 * SMF-7 authorization boundary: binds the caller to a Case before any RealtimeKit access.
 *
 * 1. Verifies the caller can read the Case in USER MODE (sharing + CRUD); otherwise denies
 *    with one indistinguishable code (no existence oracle for cases the caller cannot see).
 * 2. Maps Case → RealtimeKit meeting (created once, persisted server-side).
 * 3. Reuses one participant per (Case, User); refreshes its token, re-adding it if the
 *    provider no longer knows it.
 * 4. Returns ONLY the participant auth token. The Cloudflare API token stays in the org's
 *    External Credential; provider ids stay server-side; nothing secret is logged.
 */
public with sharing class SMF7_CallAuthService {
    private static final String MEETING_TITLE = 'SMF PoC case room';
    @TestVisible
    private static SMF7_RealtimeKitClient.Config configOverride;
    @TestVisible
    private static Boolean forceNotConfigured = false;

    private final SMF7_CallRoomStore store;


    /** Outcome codes returned to the client (stable strings, no internal detail). */
    public enum Code {
        OK,
        INVALID_CASE,
        NOT_PERMITTED,
        NO_CASE_ACCESS,
        NOT_CONFIGURED,
        PROVIDER_ERROR,
        ROOM_RACE
    }

    /** Result returned to the REST layer. */
    public class Result {
        public Code code;
        public Integer httpStatus;
        public String message;
        public String authToken;
        public String displayName;

        Result(Code code, Integer httpStatus, String message) {
            this.code = code;
            this.httpStatus = httpStatus;
            this.message = message;
        }
    }

    public SMF7_CallAuthService() {
        this(new SMF7_CallRoomStore());
    }

    @TestVisible
    private SMF7_CallAuthService(SMF7_CallRoomStore store) {
        this.store = store;
    }

    /**
     * Issues a participant token for the caller's room on the given Case.
     * @param caseIdRaw Case record id supplied by the client (never trusted)
     * @return result with the token on success, or a sanitized error
     */
    public Result issueToken(String caseIdRaw) {
        Id caseId = parseCaseId(caseIdRaw);
        if (caseId == null) {
            return new Result(Code.INVALID_CASE, 400, 'A valid Case id is required.');
        }
        if (!FeatureManagement.checkPermission(SMF7_CallRoomStore.JOIN_PERMISSION)) {
            return new Result(Code.NOT_PERMITTED, 403, 'You are not permitted to join case calls.');
        }
        if (!callerCanReadCase(caseId)) {
            return new Result(Code.NO_CASE_ACCESS, 403, 'You do not have access to this case or its call room.');
        }
        SMF7_RealtimeKitClient.Config config = loadConfig();
        if (config == null) {
            return new Result(Code.NOT_CONFIGURED, 503, 'Calling is not configured in this org.');
        }
        try {
            return issueForAuthorizedCaller(caseId, new SMF7_RealtimeKitClient(config));
        } catch (SMF7_RealtimeKitClient.ProviderException e) {
            return new Result(Code.PROVIDER_ERROR, 502, 'The call service did not respond as expected (HTTP ' + e.statusCode + ').');
        }
    }

    private Result issueForAuthorizedCaller(Id caseId, SMF7_RealtimeKitClient client) {
        Id userId = UserInfo.getUserId();
        String displayName = UserInfo.getName();
        SMF7_Call_Room__c room = store.findRoom(caseId);
        SMF7_Call_Participant__c known = room == null ? null : store.findParticipant(caseId, userId);

        // All callouts happen before any DML (platform rule: no callout after uncommitted work).
        String meetingId = room == null ? client.createMeeting(MEETING_TITLE) : room.MeetingId__c;
        String token;
        String participantId = known?.ParticipantId__c;
        if (known != null) {
            try {
                token = client.refreshToken(meetingId, participantId);
            } catch (SMF7_RealtimeKitClient.ProviderException e) {
                if (e.statusCode != 404) {
                    throw e;
                }
                token = null; // participant was deleted at the provider: add again below
            }
        }
        if (token == null) {
            SMF7_RealtimeKitClient.Participant p = client.addParticipant(meetingId, opaqueParticipantId(userId), displayName);
            token = p.token;
            participantId = p.participantId;
        }

        if (room == null) {
            room = store.insertRoom(caseId, meetingId);
            if (room == null) {
                return new Result(Code.ROOM_RACE, 409, 'The room was being created by another participant. Retry.');
            }
        }
        if (known == null || known.ParticipantId__c != participantId) {
            store.saveParticipant(room.Id, caseId, userId, participantId);
        }
        Result ok = new Result(Code.OK, 200, 'Authorized for the case call room.');
        ok.authToken = token;
        ok.displayName = displayName;
        return ok;
    }

    /**
     * Deploy-stage readiness check (run as the setup admin via anonymous Apex). Proves the
     * External Credential secret is set and valid without ever reading or printing it.
     * @return OK | NOT_CONFIGURED | PRESET_MISSING | PROVIDER_ERROR_<status>
     */
    public static String checkConfiguration() {
        SMF7_RealtimeKitClient.Config config = loadConfig();
        if (config == null) {
            return 'NOT_CONFIGURED';
        }
        try {
            return new SMF7_RealtimeKitClient(config).presetExists() ? 'OK' : 'PRESET_MISSING';
        } catch (SMF7_RealtimeKitClient.ProviderException e) {
            return 'PROVIDER_ERROR_' + e.statusCode;
        }
    }

    private static Id parseCaseId(String raw) {
        if (String.isBlank(raw) || !Pattern.matches('[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}', raw)) {
            return null;
        }
        try {
            Id parsed = Id.valueOf(raw);
            return parsed.getSObjectType() == Case.SObjectType ? parsed : null;
        } catch (StringException e) {
            return null;
        }
    }

    /** USER MODE: enforces the caller's sharing and Case object/field access. */
    private static Boolean callerCanReadCase(Id caseId) {
        try {
            return ![SELECT Id FROM Case WHERE Id = :caseId WITH USER_MODE LIMIT 1].isEmpty();
        } catch (QueryException e) {
            return false; // no Case object access at all (e.g. MF-RESTRICTED)
        }
    }

    /** Opaque, non-personal participant identifier (RealtimeKit guidance: no PII). */
    private static String opaqueParticipantId(Id userId) {
        Blob digest = Crypto.generateDigest('SHA-256', Blob.valueOf(UserInfo.getOrganizationId() + ':' + userId));
        return EncodingUtil.convertToHex(digest).left(32);
    }

    /** @return the RealtimeKit configuration (or null when not configured); used by SMF7_AccessSweep. */
    public static SMF7_RealtimeKitClient.Config currentConfig() {
        return loadConfig();
    }

    private static SMF7_RealtimeKitClient.Config loadConfig() {
        if (forceNotConfigured) {
            return null;
        }
        if (configOverride != null) {
            return configOverride;
        }
        SMF7_RealtimeKit_Config__mdt row = SMF7_RealtimeKit_Config__mdt.getInstance('Default');
        if (row == null || String.isBlank(row.AccountId__c) || String.isBlank(row.AppId__c) || String.isBlank(row.PresetName__c)) {
            return null;
        }
        SMF7_RealtimeKitClient.Config c = new SMF7_RealtimeKitClient.Config();
        c.accountId = row.AccountId__c;
        c.appId = row.AppId__c;
        c.presetName = row.PresetName__c;
        return c;
    }
}
