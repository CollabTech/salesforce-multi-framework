/**
 * SMF-12 revocation enforcement (finding A2; SMF-12 AC4, SYNC-03).
 *
 * A live-sync room token is valid until it expires (SMF12_RoomTokenService.TTL_SECONDS), so
 * removing a user's case access or SMF12_Access stops only NEW tokens. This sweep re-checks
 * every user holding an unexpired token (SMF12_Room_Grant__c) against the rules the token
 * endpoint applies, as of now:
 *   - the user is active,
 *   - the user can still call SMF12_RoomTokenResource (Apex class access through any
 *     permission set, including the profile's),
 *   - the user has edit access to the Case (UserRecordAccess).
 * For a user who fails any rule it calls POST /revoke on the sync service through the
 * SMF12_MarkupSync Named Credential. The service closes that user's sessions in the case room
 * at once and refuses every token issued before the revocation; the client's reconnect asks
 * Apex for a new token, which is refused. Expired grants are removed.
 *
 * Runs system-wide (without sharing) because it inspects other users' access. Started and
 * stopped only by an administrator who holds SMF12_Access (for the Named Credential):
 * start(intervalMinutes) / stop(). Each run is a Queueable with callouts; all callouts happen
 * before any DML. Enforcement latency = interval + queue delay + service close; the live run
 * measures it (docs/findings/token-revocation.md).
 */
public without sharing class SMF12_AccessSweep implements Schedulable, Queueable, Database.AllowsCallouts {
    public static final String JOB_PREFIX = 'SMF12 access sweep ';
    public static final String TOKEN_CLASS = 'SMF12_RoomTokenResource';
    @TestVisible
    private static final Integer MAX_PER_RUN = 90; // callout limit is 100 per transaction

    /** One revoked (user, case) grant. */
    public class Revocation {
        public Id userId;
        public Id caseId;
        public String reason;
    }

    /**
     * Scheduled entry point: hands off to a Queueable, because scheduled Apex cannot make callouts.
     * @param ctx scheduler context (unused)
     */
    public void execute(SchedulableContext ctx) {
        System.enqueueJob(new SMF12_AccessSweep());
    }

    /**
     * Queueable entry point (callouts allowed).
     * @param ctx queueable context (unused)
     */
    public void execute(QueueableContext ctx) {
        run();
    }

    /**
     * Re-checks every unexpired grant and pushes a revocation for those no longer authorized.
     * @return the revocations performed in this run
     */
    public static List<Revocation> run() {
        List<Revocation> done = new List<Revocation>();
        DateTime now = System.now();
        List<SMF12_Room_Grant__c> expired = [
            SELECT Id FROM SMF12_Room_Grant__c WHERE ExpiresAt__c <= :now WITH SYSTEM_MODE LIMIT 9000
        ];
        List<SMF12_Room_Grant__c> rows = [
            SELECT Id, User__c, User__r.IsActive, Case__c
            FROM SMF12_Room_Grant__c
            WHERE ExpiresAt__c > :now
            WITH SYSTEM_MODE
            ORDER BY LastModifiedDate
            LIMIT :MAX_PER_RUN
        ];
        List<SMF12_Room_Grant__c> toDelete = new List<SMF12_Room_Grant__c>(expired);
        if (!rows.isEmpty()) {
            Set<Id> callers = usersWithTokenAccess(rows);
            Map<Id, Set<Id>> editable = editableCasesByUser(rows);
            for (SMF12_Room_Grant__c row : rows) {
                String reason = reasonToRevoke(row, callers, editable);
                if (reason == null || !pushRevoke(row.User__c, row.Case__c)) {
                    continue; // authorized, or the service refused: kept, so the next run retries
                }
                Revocation r = new Revocation();
                r.userId = row.User__c;
                r.caseId = row.Case__c;
                r.reason = reason;
                done.add(r);
                toDelete.add(row);
            }
        }
        if (!toDelete.isEmpty()) {
            Database.delete(toDelete, false, AccessLevel.SYSTEM_MODE);
        }
        for (Revocation r : done) {
            System.debug(LoggingLevel.ERROR, 'SMF12REVOKE|' + r.reason + '|' + System.now().getTime());
        }
        return done;
    }

    @TestVisible
    private static String reasonToRevoke(SMF12_Room_Grant__c row, Set<Id> callers, Map<Id, Set<Id>> editable) {
        if (row.User__r == null || !row.User__r.IsActive) {
            return 'USER_INACTIVE';
        }
        if (!callers.contains(row.User__c)) {
            return 'TOKEN_ACCESS_REMOVED';
        }
        Set<Id> cases = editable.get(row.User__c);
        if (row.Case__c == null || cases == null || !cases.contains(row.Case__c)) {
            return 'CASE_ACCESS_REMOVED';
        }
        return null;
    }

    private static Boolean pushRevoke(Id userId, Id caseId) {
        if (caseId == null) {
            return true; // case deleted: no room left to protect; drop the grant
        }
        HttpRequest request = new HttpRequest();
        request.setEndpoint('callout:' + SMF12_RoomTokenService.NAMED_CREDENTIAL + '/revoke');
        request.setMethod('POST');
        request.setTimeout(10000);
        request.setHeader('Content-Type', 'application/json');
        request.setBody(JSON.serialize(new Map<String, Object>{ 'userId' => String.valueOf(userId), 'caseId' => String.valueOf(caseId) }));
        try {
            return new Http().send(request).getStatusCode() == 200;
        } catch (CalloutException e) {
            return false;
        }
    }

    private static Set<Id> usersWithTokenAccess(List<SMF12_Room_Grant__c> rows) {
        Set<Id> users = new Set<Id>();
        for (SMF12_Room_Grant__c row : rows) {
            users.add(row.User__c);
        }
        Set<Id> result = new Set<Id>();
        List<ApexClass> classes = [SELECT Id FROM ApexClass WHERE Name = :TOKEN_CLASS WITH SYSTEM_MODE LIMIT 1];
        if (classes.isEmpty()) {
            return result;
        }
        Map<Id, Set<Id>> permSetsByUser = new Map<Id, Set<Id>>();
        Set<Id> permSets = new Set<Id>();
        for (PermissionSetAssignment a : [
            SELECT AssigneeId, PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId IN :users WITH SYSTEM_MODE
        ]) {
            if (!permSetsByUser.containsKey(a.AssigneeId)) {
                permSetsByUser.put(a.AssigneeId, new Set<Id>());
            }
            permSetsByUser.get(a.AssigneeId).add(a.PermissionSetId);
            permSets.add(a.PermissionSetId);
        }
        Set<Id> granting = new Set<Id>();
        for (SetupEntityAccess sea : [
            SELECT ParentId FROM SetupEntityAccess WHERE SetupEntityId = :classes[0].Id AND ParentId IN :permSets WITH SYSTEM_MODE
        ]) {
            granting.add(sea.ParentId);
        }
        for (Id u : permSetsByUser.keySet()) {
            for (Id ps : permSetsByUser.get(u)) {
                if (granting.contains(ps)) {
                    result.add(u);
                    break;
                }
            }
        }
        return result;
    }

    private static Map<Id, Set<Id>> editableCasesByUser(List<SMF12_Room_Grant__c> rows) {
        Map<Id, Set<Id>> casesByUser = new Map<Id, Set<Id>>();
        for (SMF12_Room_Grant__c row : rows) {
            if (row.Case__c == null) {
                continue;
            }
            if (!casesByUser.containsKey(row.User__c)) {
                casesByUser.put(row.User__c, new Set<Id>());
            }
            casesByUser.get(row.User__c).add(row.Case__c);
        }
        Map<Id, Set<Id>> editable = new Map<Id, Set<Id>>();
        for (Id u : casesByUser.keySet()) {
            Set<Id> ok = new Set<Id>();
            List<Id> ids = new List<Id>(casesByUser.get(u));
            // UserRecordAccess: one user per query, at most 200 record ids.
            for (UserRecordAccess ura : [
                SELECT RecordId, HasEditAccess FROM UserRecordAccess WHERE UserId = :u AND RecordId IN :ids
            ]) {
                if (ura.HasEditAccess) {
                    ok.add(ura.RecordId);
                }
            }
            editable.put(u, ok);
        }
        return editable;
    }

    /**
     * Schedules the sweep every intervalMinutes (1..30) within each hour; replaces earlier jobs.
     * @param intervalMinutes minutes between runs
     * @return number of scheduled jobs
     */
    public static Integer start(Integer intervalMinutes) {
        if (intervalMinutes == null || intervalMinutes < 1 || intervalMinutes > 30) {
            throw new IllegalArgumentException('intervalMinutes must be 1..30');
        }
        stop();
        Integer n = 0;
        for (Integer m = 0; m < 60; m += intervalMinutes) {
            System.schedule(JOB_PREFIX + String.valueOf(m).leftPad(2, '0'), '0 ' + m + ' * * * ?', new SMF12_AccessSweep());
            n++;
        }
        return n;
    }

    /**
     * Aborts every scheduled sweep job.
     * @return number of sweep jobs aborted
     */
    public static Integer stop() {
        Integer n = 0;
        for (CronTrigger ct : [
            SELECT Id FROM CronTrigger WHERE CronJobDetail.Name LIKE :(JOB_PREFIX + '%') WITH SYSTEM_MODE
        ]) {
            System.abortJob(ct.Id);
            n++;
        }
        return n;
    }
}
