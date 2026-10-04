/**
 * SMF-7 revocation enforcement (finding A1; SMF-7 AC2, CALL-03).
 *
 * A RealtimeKit participant token lives 100 days and is not tied to the Salesforce session, so
 * removing a user's case access or SMF7_Join_Call only stops NEW tokens. This sweep re-checks
 * every stored (case, user) participant against the same rules the token endpoint applies, as
 * of now:
 *   - the user is active,
 *   - the user holds the SMF7_Join_Call custom permission (through any permission set,
 *     including the profile's),
 *   - the user can read the room's Case (UserRecordAccess).
 * A participant that fails any rule is deleted at RealtimeKit (its tokens stop working) and
 * its mapping is removed, so a later legitimate request issues a fresh participant.
 *
 * Runs system-wide (without sharing) because it inspects other users' access. It is started
 * and stopped only by an administrator: SMF7_AccessSweep.start(intervalMinutes) schedules one
 * job per interval slot within the hour; stop() aborts them. Each run is a Queueable with
 * callouts. All callouts happen before any DML. Enforcement latency = interval + queue delay;
 * the live run measures it (docs/findings/token-revocation.md).
 */
public without sharing class SMF7_AccessSweep implements Schedulable, Queueable, Database.AllowsCallouts {
    public static final String JOB_PREFIX = 'SMF7 access sweep ';
    @TestVisible
    private static final Integer MAX_PER_RUN = 90; // callout limit is 100 per transaction

    /** One revoked participant (no provider identifiers or names are exposed). */
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
        System.enqueueJob(new SMF7_AccessSweep());
    }

    /**
     * Queueable entry point (callouts allowed).
     * @param ctx queueable context (unused)
     */
    public void execute(QueueableContext ctx) {
        run();
    }

    /**
     * Re-checks every stored participant and revokes those no longer authorized.
     * @return the revocations performed in this run
     */
    public static List<Revocation> run() {
        List<Revocation> done = new List<Revocation>();
        SMF7_RealtimeKitClient.Config config = SMF7_CallAuthService.currentConfig();
        if (config == null) {
            return done;
        }
        List<SMF7_Call_Participant__c> rows = [
            SELECT Id, User__c, User__r.IsActive, ParticipantId__c, Room__r.Case__c, Room__r.MeetingId__c
            FROM SMF7_Call_Participant__c
            WITH SYSTEM_MODE
            ORDER BY LastModifiedDate
            LIMIT :MAX_PER_RUN
        ];
        if (rows.isEmpty()) {
            return done;
        }
        Set<Id> joiners = usersWithJoinPermission(rows);
        Map<Id, Set<Id>> readable = readableCasesByUser(rows);
        SMF7_RealtimeKitClient client = new SMF7_RealtimeKitClient(config);
        List<SMF7_Call_Participant__c> toDelete = new List<SMF7_Call_Participant__c>();
        for (SMF7_Call_Participant__c row : rows) {
            String reason = reasonToRevoke(row, joiners, readable);
            if (reason == null) {
                continue;
            }
            try {
                client.deleteParticipant(row.Room__r.MeetingId__c, row.ParticipantId__c);
            } catch (SMF7_RealtimeKitClient.ProviderException e) {
                continue; // retried by the next run; the mapping is kept so it is not lost
            }
            Revocation r = new Revocation();
            r.userId = row.User__c;
            r.caseId = row.Room__r.Case__c;
            r.reason = reason;
            done.add(r);
            toDelete.add(row);
        }
        if (!toDelete.isEmpty()) {
            Database.delete(toDelete, false, AccessLevel.SYSTEM_MODE);
            for (Revocation r : done) {
                System.debug(LoggingLevel.ERROR, 'SMF7REVOKE|' + r.reason + '|' + System.now().getTime());
            }
        }
        return done;
    }

    @TestVisible
    private static String reasonToRevoke(SMF7_Call_Participant__c row, Set<Id> joiners, Map<Id, Set<Id>> readable) {
        if (row.User__r == null || !row.User__r.IsActive) {
            return 'USER_INACTIVE';
        }
        if (!joiners.contains(row.User__c)) {
            return 'JOIN_PERMISSION_REMOVED';
        }
        Set<Id> cases = readable.get(row.User__c);
        if (cases == null || !cases.contains(row.Room__r.Case__c)) {
            return 'CASE_ACCESS_REMOVED';
        }
        return null;
    }

    private static Set<Id> usersWithJoinPermission(List<SMF7_Call_Participant__c> rows) {
        Set<Id> users = new Set<Id>();
        for (SMF7_Call_Participant__c row : rows) {
            users.add(row.User__c);
        }
        Set<Id> result = new Set<Id>();
        List<CustomPermission> cps = [
            SELECT Id FROM CustomPermission WHERE DeveloperName = :SMF7_CallRoomStore.JOIN_PERMISSION WITH SYSTEM_MODE LIMIT 1
        ];
        if (cps.isEmpty()) {
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
            SELECT ParentId FROM SetupEntityAccess WHERE SetupEntityId = :cps[0].Id AND ParentId IN :permSets WITH SYSTEM_MODE
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

    private static Map<Id, Set<Id>> readableCasesByUser(List<SMF7_Call_Participant__c> rows) {
        Map<Id, Set<Id>> casesByUser = new Map<Id, Set<Id>>();
        for (SMF7_Call_Participant__c row : rows) {
            if (!casesByUser.containsKey(row.User__c)) {
                casesByUser.put(row.User__c, new Set<Id>());
            }
            casesByUser.get(row.User__c).add(row.Room__r.Case__c);
        }
        Map<Id, Set<Id>> readable = new Map<Id, Set<Id>>();
        for (Id u : casesByUser.keySet()) {
            Set<Id> ok = new Set<Id>();
            List<Id> ids = new List<Id>(casesByUser.get(u));
            // UserRecordAccess: one user per query, at most 200 record ids.
            for (UserRecordAccess ura : [
                SELECT RecordId, HasReadAccess FROM UserRecordAccess WHERE UserId = :u AND RecordId IN :ids
            ]) {
                if (ura.HasReadAccess) {
                    ok.add(ura.RecordId);
                }
            }
            readable.put(u, ok);
        }
        return readable;
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
            System.schedule(JOB_PREFIX + String.valueOf(m).leftPad(2, '0'), '0 ' + m + ' * * * ?', new SMF7_AccessSweep());
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
