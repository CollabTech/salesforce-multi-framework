/**
 * SMF-7 test data: synthetic users and cases mirroring the SMF-3 persona baseline
 * (Minimum Access profile, Case read via permission set, Case OWD Private).
 */
@IsTest
public class SMF7_TestDataFactory {
    private static Integer seq = 0;

    /**
     * @param alias short unique alias
     * @param caseRead grant Case read/edit through a test permission set
     * @param joinCall assign SMF7_Access (custom permission SMF7_Join_Call)
     * @return inserted user
     */
    public static User createUser(String alias, Boolean caseRead, Boolean joinCall) {
        seq++;
        List<Profile> profiles = [SELECT Id FROM Profile WHERE Name IN ('Minimum Access - Salesforce', 'Standard User') ORDER BY Name LIMIT 1];
        User u = new User(
            Alias = alias,
            LastName = 'SMF7 ' + alias,
            Email = alias + '@example.invalid',
            Username = 'smf7.' + alias + '.' + seq + '.' + Crypto.getRandomInteger() + '@example.invalid',
            ProfileId = profiles[0].Id,
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            TimeZoneSidKey = 'America/New_York'
        );
        insert u;
        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        if (caseRead) {
            PermissionSet ps = new PermissionSet(Name = 'SMF7_Test_CaseRead_' + seq, Label = 'SMF7 Test Case Read ' + seq);
            insert ps;
            insert new ObjectPermissions(ParentId = ps.Id, SobjectType = 'Case', PermissionsRead = true, PermissionsEdit = true);
            assignments.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id));
        }
        if (joinCall) {
            PermissionSet access = [SELECT Id FROM PermissionSet WHERE Name = 'SMF7_Access' LIMIT 1];
            assignments.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = access.Id));
        }
        insert assignments;
        return u;
    }

    /**
     * @param ownerId case owner (OWD Private: only the owner sees it unless shared)
     * @param subject synthetic subject
     * @return inserted case
     */
    public static Case createCase(Id ownerId, String subject) {
        Case c = new Case(Subject = subject, Status = 'New', Origin = 'Web', OwnerId = ownerId);
        insert c;
        return c;
    }
}
