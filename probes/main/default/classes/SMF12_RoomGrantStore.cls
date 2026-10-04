/**
 * SMF-12: records which users hold an unexpired room token for which case (finding A2), so
 * SMF12_AccessSweep knows whom to re-check. Stores no token. Runs in system mode because the
 * caller (a persona minting a token) has no access to this server-side object.
 */
public without sharing class SMF12_RoomGrantStore {

    /**
     * Upserts the grant for the calling user after a token was minted.
     * @param caseId case the token admits to
     * @param expiresAt token expiry in epoch seconds
     */
    public static void recordIssued(Id caseId, Long expiresAt) {
        Id userId = UserInfo.getUserId();
        SMF12_Room_Grant__c row = new SMF12_Room_Grant__c(
            UniqueKey__c = key(caseId, userId),
            Case__c = caseId,
            User__c = userId,
            ExpiresAt__c = DateTime.newInstance((expiresAt == null ? 0L : expiresAt) * 1000)
        );
        Database.upsert(row, SMF12_Room_Grant__c.UniqueKey__c, true, AccessLevel.SYSTEM_MODE);
    }

    @TestVisible
    private static String key(Id caseId, Id userId) {
        return String.valueOf(caseId).left(15) + ':' + String.valueOf(userId).left(15);
    }
}
