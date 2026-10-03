/**
 * SMF-7: server-side persistence of Case → RealtimeKit meeting and (Case, User) → participant.
 *
 * Elevated access is deliberate and narrow: business users have NO object permissions on
 * SMF7_Call_Room__c / SMF7_Call_Participant__c, so provider meeting/participant identifiers
 * are never readable through any user-facing API. This class is only reachable from
 * SMF7_CallAuthService AFTER that service has verified, in user mode, that the caller can see
 * the Case. It additionally requires the SMF7_Join_Call custom permission (granted by
 * SMF7_Access) before touching the store.
 */
public without sharing class SMF7_CallRoomStore {
    public static final String JOIN_PERMISSION = 'SMF7_Join_Call';

    /** Thrown when the caller lacks the SMF7_Join_Call custom permission. */
    public class StoreAccessException extends Exception {
    }

    /**
     * @param caseId case whose room is wanted
     * @return the room or null
     */
    public SMF7_Call_Room__c findRoom(Id caseId) {
        requirePermission();
        List<SMF7_Call_Room__c> rooms = [
            SELECT Id, MeetingId__c
            FROM SMF7_Call_Room__c
            WHERE CaseKey__c = :String.valueOf(caseId)
            WITH SYSTEM_MODE
            LIMIT 1
        ];
        return rooms.isEmpty() ? null : rooms[0];
    }

    /**
     * @param caseId case
     * @param userId Salesforce user
     * @return the participant mapping or null
     */
    public SMF7_Call_Participant__c findParticipant(Id caseId, Id userId) {
        requirePermission();
        List<SMF7_Call_Participant__c> rows = [
            SELECT Id, ParticipantId__c
            FROM SMF7_Call_Participant__c
            WHERE UniqueKey__c = :participantKey(caseId, userId)
            WITH SYSTEM_MODE
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    /**
     * Persists a new room. Returns false when another request created the room first
     * (unique CaseKey__c), so the caller can ask the client to retry.
     * @param caseId case
     * @param meetingId RealtimeKit meeting id
     * @return the saved room, or null on a concurrent-creation race
     */
    public SMF7_Call_Room__c insertRoom(Id caseId, String meetingId) {
        requirePermission();
        SMF7_Call_Room__c room = new SMF7_Call_Room__c(Case__c = caseId, CaseKey__c = String.valueOf(caseId), MeetingId__c = meetingId);
        Database.SaveResult result = Database.insert(room, false, AccessLevel.SYSTEM_MODE);
        return result.isSuccess() ? room : null;
    }

    /**
     * Creates or updates the (case, user) participant mapping.
     * @param roomId room record
     * @param caseId case
     * @param userId Salesforce user
     * @param participantId RealtimeKit participant id
     */
    public void saveParticipant(Id roomId, Id caseId, Id userId, String participantId) {
        requirePermission();
        SMF7_Call_Participant__c row = new SMF7_Call_Participant__c(
            Room__c = roomId,
            User__c = userId,
            UniqueKey__c = participantKey(caseId, userId),
            ParticipantId__c = participantId
        );
        Database.upsert(row, SMF7_Call_Participant__c.UniqueKey__c, true, AccessLevel.SYSTEM_MODE);
    }

    @TestVisible
    private static String participantKey(Id caseId, Id userId) {
        return String.valueOf(caseId) + ':' + String.valueOf(userId);
    }

    private static void requirePermission() {
        if (!FeatureManagement.checkPermission(JOIN_PERMISSION)) {
            throw new StoreAccessException('Missing custom permission ' + JOIN_PERMISSION);
        }
    }
}
