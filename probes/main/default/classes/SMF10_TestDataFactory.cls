/**
 * Test-only data factory for SMF-10..12 Apex tests. Builds synthetic stand-ins for the
 * SMF-3 personas (MF-TECH owner, MF-RESTRICTED non-owner) and fixtures (MF-CASE-001,
 * MF-CASE-002, MF-IMAGE-001, MF-FILE-DENIED). These exist only inside the test
 * transaction; they are not the SMF-3 org fixtures and prove nothing about them.
 *
 * Denial assertions assume the SMF-3 sharing baseline: Case org-wide default Private
 * (internal), so a Standard User who does not own a case cannot see it.
 */
@IsTest
public class SMF10_TestDataFactory {

    public static final String STANDARD_PROFILE = 'Standard User';
    /** 1x1 transparent PNG; stands in for MF-IMAGE-001 in tests only. */
    public static final String PNG_BASE64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    /**
     * Creates a non-admin Standard User with a synthetic, org-unique username.
     * @param alias short label used in the synthetic username
     * @return inserted user
     */
    public static User createStandardUser(String alias) {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = :STANDARD_PROFILE LIMIT 1];
        String unique = alias + String.valueOf(Crypto.getRandomInteger()).replace('-', '');
        User testUser = new User(
            ProfileId = standardProfile.Id,
            Username = unique + '@smf.test.invalid',
            Email = unique + '@smf.test.invalid',
            LastName = 'SMF ' + alias,
            Alias = alias.left(8),
            TimeZoneSidKey = 'GMT',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        insert testUser;
        return testUser;
    }

    /**
     * Inserts a synthetic case as the running user.
     * @param subject case subject
     * @return inserted case
     */
    public static Case createCase(String subject) {
        Case testCase = new Case(Subject = subject, Status = 'New', Origin = 'Web');
        insert testCase;
        return testCase;
    }

    /**
     * Inserts a PNG ContentVersion linked to the record via FirstPublishLocationId
     * (Salesforce creates the ContentDocumentLink).
     * @param recordId record to link
     * @param title file title
     * @param description optional description (idempotency marker in SMF-10)
     * @return inserted version re-queried with ContentDocumentId
     */
    public static ContentVersion createImageVersion(Id recordId, String title, String description) {
        ContentVersion version = new ContentVersion(
            Title = title,
            PathOnClient = title + '.png',
            VersionData = EncodingUtil.base64Decode(PNG_BASE64),
            FirstPublishLocationId = recordId,
            Description = description
        );
        insert version;
        return [SELECT Id, ContentDocumentId, Title FROM ContentVersion WHERE Id = :version.Id];
    }
}
