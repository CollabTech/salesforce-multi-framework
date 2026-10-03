/**
 * SMF-3 DATA-02 org-level access verification for the provisioned personas and fixtures.
 *
 * Deliberately @IsTest(SeeAllData=true): this class checks the REAL provisioned org state
 * (users from personas.py, records/Files from fixtures.py), not code under test, so it
 * cannot build its own data. See testing/provisioning/README.md and docs/contradictions.md C-06.
 * It never creates records; the update attempts below are rolled back with the test.
 *
 * System.runAs enforces the persona's record sharing; WITH USER_MODE / AccessLevel.USER_MODE
 * add object and field permissions. A runAs pass does NOT prove UI login or mobile access:
 * the per-environment scripts in docs/test-scripts/ cover that.
 *
 * Fixture keys (logical, never IDs): Account.Name, Case.Subject + AccountId,
 * Asset.SerialNumber, ContentVersion.Title; personas: User.FederationIdentifier.
 */
@IsTest(SeeAllData=true)
private class MF_AccessBaselineTest {
    private static final String ACCOUNT_NAME = 'CollabTech PoC Test Customer';
    private static final String CASE1_SUBJECT = 'Pump overheating — remote diagnosis';
    private static final String CASE2_SUBJECT = 'MF-CASE-002 restricted negative control (synthetic)';
    private static final String NOTE = 'MF_AccessBaselineTest edit probe (rolled back)';

    // ------------------------------------------------------------------ fixture lookups (as the running admin)

    private static User persona(String logicalId) {
        List<User> users = [SELECT Id FROM User WHERE FederationIdentifier = :logicalId AND IsActive = true];
        Assert.areEqual(1, users.size(), logicalId + ' must exist exactly once (testing/provisioning/personas.py)');
        return users[0];
    }

    private static Id caseId(String subject) {
        List<Case> cases = [SELECT Id FROM Case WHERE Subject = :subject AND Account.Name = :ACCOUNT_NAME];
        Assert.areEqual(1, cases.size(), 'fixture case "' + subject + '" must exist exactly once (fixtures.py seed)');
        return cases[0].Id;
    }

    private static Id assetId(String serial) {
        List<Asset> assets = [SELECT Id FROM Asset WHERE SerialNumber = :serial];
        Assert.areEqual(1, assets.size(), 'fixture asset ' + serial + ' must exist exactly once (fixtures.py seed)');
        return assets[0].Id;
    }

    private static Id documentId(String title) {
        List<ContentVersion> versions = [SELECT ContentDocumentId FROM ContentVersion
                                         WHERE Title = :title AND IsLatest = true AND OwnerId = :UserInfo.getUserId()];
        Assert.areEqual(1, versions.size(), 'fixture File ' + title + ' must exist exactly once, owned by MF-ADMIN');
        return versions[0].ContentDocumentId;
    }

    // ------------------------------------------------------------------ probes (run inside System.runAs)

    private static Boolean canSeeCase(Id recordId) {
        try {
            return [SELECT Id FROM Case WHERE Id = :recordId WITH USER_MODE].size() == 1;
        } catch (QueryException e) {
            return false;   // no object access is also a denial
        }
    }

    private static Boolean canSeeAsset(Id recordId) {
        try {
            return [SELECT Id FROM Asset WHERE Id = :recordId WITH USER_MODE].size() == 1;
        } catch (QueryException e) {
            return false;
        }
    }

    private static Boolean canSeeFile(Id docId) {
        try {
            return [SELECT Id FROM ContentVersion WHERE ContentDocumentId = :docId AND IsLatest = true WITH USER_MODE].size() == 1;
        } catch (QueryException e) {
            return false;
        }
    }

    private static Boolean canEditCase(Id recordId) {
        Database.SaveResult result = Database.update(new Case(Id = recordId, Description = NOTE), false, AccessLevel.USER_MODE);
        return result.isSuccess();
    }

    private static Boolean canEditAsset(Id recordId) {
        Database.SaveResult result = Database.update(new Asset(Id = recordId, Description = NOTE), false, AccessLevel.USER_MODE);
        return result.isSuccess();
    }

    // ------------------------------------------------------------------ MF-CASE-001 and its image: TECH, SUPPORT allowed

    @IsTest
    static void techReadsAndEditsCase001() {
        Id c1 = caseId(CASE1_SUBJECT);
        Boolean seen;
        Boolean edited;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeCase(c1); edited = canEditCase(c1); }
        Test.stopTest();
        Assert.isTrue(seen, 'MF-TECH must read MF-CASE-001');
        Assert.isTrue(edited, 'MF-TECH must update MF-CASE-001');
    }

    @IsTest
    static void supportReadsAndEditsCase001() {
        Id c1 = caseId(CASE1_SUBJECT);
        Boolean seen;
        Boolean edited;
        Test.startTest();
        System.runAs(persona('MF-SUPPORT')) { seen = canSeeCase(c1); edited = canEditCase(c1); }
        Test.stopTest();
        Assert.isTrue(seen, 'MF-SUPPORT must read MF-CASE-001');
        Assert.isTrue(edited, 'MF-SUPPORT must update MF-CASE-001');
    }

    @IsTest
    static void techReadsAndEditsAsset001() {
        Id a1 = assetId('MF-ASSET-001');
        Boolean seen;
        Boolean edited;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeAsset(a1); edited = canEditAsset(a1); }
        Test.stopTest();
        Assert.isTrue(seen, 'MF-TECH must read its equipment MF-ASSET-001');
        Assert.isTrue(edited, 'MF-TECH must update its equipment MF-ASSET-001');
    }

    @IsTest
    static void techReadsImage001() {
        Id doc = documentId('MF-IMAGE-001');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isTrue(seen, 'MF-TECH must read MF-IMAGE-001 through MF-CASE-001');
    }

    @IsTest
    static void supportReadsImage001() {
        Id doc = documentId('MF-IMAGE-001');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-SUPPORT')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isTrue(seen, 'MF-SUPPORT must read MF-IMAGE-001 through MF-CASE-001');
    }

    // ------------------------------------------------------------------ RESTRICTED: no case, asset or File

    @IsTest
    static void restrictedCannotReadCase001() {
        Id c1 = caseId(CASE1_SUBJECT);
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-RESTRICTED')) { seen = canSeeCase(c1); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-RESTRICTED must not read MF-CASE-001');
    }

    @IsTest
    static void restrictedCannotReadImage001() {
        Id doc = documentId('MF-IMAGE-001');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-RESTRICTED')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-RESTRICTED must not read MF-IMAGE-001');
    }

    @IsTest
    static void restrictedCannotReadAsset001() {
        Id a1 = assetId('MF-ASSET-001');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-RESTRICTED')) { seen = canSeeAsset(a1); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-RESTRICTED must not read MF-ASSET-001');
    }

    // ------------------------------------------------------------------ MF-CASE-002 / MF-ASSET-002 / MF-FILE-DENIED: all business personas denied

    @IsTest
    static void techCannotReadOrEditCase002() {
        Id c2 = caseId(CASE2_SUBJECT);
        Boolean seen;
        Boolean edited;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeCase(c2); edited = canEditCase(c2); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-TECH must not read MF-CASE-002');
        Assert.isFalse(edited, 'MF-TECH must not update MF-CASE-002');
    }

    @IsTest
    static void supportCannotReadOrEditCase002() {
        Id c2 = caseId(CASE2_SUBJECT);
        Boolean seen;
        Boolean edited;
        Test.startTest();
        System.runAs(persona('MF-SUPPORT')) { seen = canSeeCase(c2); edited = canEditCase(c2); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-SUPPORT must not read MF-CASE-002');
        Assert.isFalse(edited, 'MF-SUPPORT must not update MF-CASE-002');
    }

    @IsTest
    static void restrictedCannotReadCase002() {
        Id c2 = caseId(CASE2_SUBJECT);
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-RESTRICTED')) { seen = canSeeCase(c2); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-RESTRICTED must not read MF-CASE-002');
    }

    @IsTest
    static void techCannotReadAsset002() {
        Id a2 = assetId('MF-ASSET-002');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeAsset(a2); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-TECH must not read MF-ASSET-002 (linked to MF-CASE-002)');
    }

    @IsTest
    static void supportCannotReadAsset002() {
        Id a2 = assetId('MF-ASSET-002');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-SUPPORT')) { seen = canSeeAsset(a2); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-SUPPORT must not read MF-ASSET-002 (linked to MF-CASE-002)');
    }

    @IsTest
    static void techCannotReadFileDenied() {
        Id doc = documentId('MF-FILE-DENIED');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-TECH')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-TECH must not read MF-FILE-DENIED');
    }

    @IsTest
    static void supportCannotReadFileDenied() {
        Id doc = documentId('MF-FILE-DENIED');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-SUPPORT')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-SUPPORT must not read MF-FILE-DENIED');
    }

    @IsTest
    static void restrictedCannotReadFileDenied() {
        Id doc = documentId('MF-FILE-DENIED');
        Boolean seen;
        Test.startTest();
        System.runAs(persona('MF-RESTRICTED')) { seen = canSeeFile(doc); }
        Test.stopTest();
        Assert.isFalse(seen, 'MF-RESTRICTED must not read MF-FILE-DENIED');
    }

    @IsTest
    static void fixtureFilesHaveNoPublicLinks() {
        Set<Id> docs = new Set<Id>{ documentId('MF-IMAGE-001'), documentId('MF-FILE-DENIED') };
        Test.startTest();
        Integer publicLinks = [SELECT COUNT() FROM ContentDistribution WHERE ContentDocumentId IN :docs];
        Test.stopTest();
        Assert.areEqual(0, publicLinks, 'fixture Files must have no ContentDistribution (public link)');
    }
}
