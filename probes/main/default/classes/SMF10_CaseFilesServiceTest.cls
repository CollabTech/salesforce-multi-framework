/**
 * Tests for SMF10_CaseFilesService: owner read-back, denial for a user without case
 * access, denial for a File linked only to another case, and no public link creation.
 * Denials assume Case OWD Private (SMF-3 baseline; see SMF10_TestDataFactory).
 */
@IsTest
private class SMF10_CaseFilesServiceTest {

    private static final String TECH_ALIAS = 'smftech';
    private static final String RESTRICTED_ALIAS = 'smfrestr';
    private static final String IMAGE_TITLE = 'MF-IMAGE-001';
    private static final String DENIED_TITLE = 'MF-FILE-DENIED';

    @TestSetup
    static void setupTestData() {
        User tech = SMF10_TestDataFactory.createStandardUser(TECH_ALIAS);
        SMF10_TestDataFactory.createStandardUser(RESTRICTED_ALIAS);
        System.runAs(tech) {
            Case permitted = SMF10_TestDataFactory.createCase('MF-CASE-001 Pump overheating');
            SMF10_TestDataFactory.createImageVersion(permitted.Id, IMAGE_TITLE, 'smf10:key=test-key-1');
        }
        // The running (setup) user owns the negative-control case and its File.
        Case restrictedCase = SMF10_TestDataFactory.createCase('MF-CASE-002 negative control');
        SMF10_TestDataFactory.createImageVersion(restrictedCase.Id, DENIED_TITLE, null);
    }

    private static User userByAlias(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias.left(8) LIMIT 1];
    }

    private static Case caseBySubjectPrefix(String prefix) {
        String pattern = prefix + '%';
        return [SELECT Id FROM Case WHERE Subject LIKE :pattern LIMIT 1];
    }

    private static ContentVersion versionByTitle(String title) {
        return visibleVersions(title)[0];
    }

    /**
     * Reads test Files as a user who may see them: the running admin first (it created the
     * negative-control file), then the test TECH user who created the case files. Users without
     * "Query All Files" only see files shared with them, so an admin-only read misses TECH's files.
     */
    private static List<ContentVersion> visibleVersions(String title) {
        List<ContentVersion> rows = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Title = :title AND IsLatest = TRUE LIMIT 1];
        if (rows.isEmpty()) {
            System.runAs([SELECT Id FROM User WHERE Alias = :TECH_ALIAS.left(8) LIMIT 1][0]) {
                rows = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Title = :title AND IsLatest = TRUE LIMIT 1];
            }
        }
        return rows;
    }


    @IsTest
    static void shouldListLinkedFile_WhenCallerOwnsCase() {
        Case permitted = caseBySubjectPrefix('MF-CASE-001');
        List<SMF10_CaseFilesService.FileInfo> files;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            files = SMF10_CaseFilesService.listCaseFiles(permitted.Id);
        }
        Test.stopTest();
        Assert.areEqual(1, files.size(), 'Owner should see exactly the one linked File');
        Assert.areEqual(String.valueOf(permitted.Id), files[0].linkedEntityId, 'Link must point at MF-CASE-001');
        Assert.areEqual(IMAGE_TITLE, files[0].title, 'Title should round-trip');
        Assert.areEqual('smf10:key=test-key-1', files[0].description, 'Idempotency marker should round-trip');
        Assert.areEqual('1', files[0].versionNumber, 'First version expected');
    }

    @IsTest
    static void shouldReportNoPublicLink_WhenFileUploaded() {
        Case permitted = caseBySubjectPrefix('MF-CASE-001');
        List<SMF10_CaseFilesService.FileInfo> files;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            files = SMF10_CaseFilesService.listCaseFiles(permitted.Id);
        }
        Test.stopTest();
        Assert.isTrue(files[0].publicLinkCount == null || files[0].publicLinkCount == 0,
            'No ContentDistribution may exist for the uploaded File');
    }

    @IsTest
    static void shouldReturnVersionData_WhenCallerOwnsCase() {
        ContentVersion image = versionByTitle(IMAGE_TITLE);
        ContentVersion result;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            result = SMF10_CaseFilesService.getVersionWithData(image.Id);
        }
        Test.stopTest();
        Assert.areEqual(SMF10_TestDataFactory.PNG_BASE64, EncodingUtil.base64Encode(result.VersionData),
            'Bytes read back must equal the bytes stored');
    }

    @IsTest
    static void shouldDenyCaseFiles_WhenCallerHasNoCaseAccess() {
        Case permitted = caseBySubjectPrefix('MF-CASE-001');
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            try {
                SMF10_CaseFilesService.listCaseFiles(permitted.Id);
                Assert.fail('MF-RESTRICTED stand-in must not list MF-CASE-001 Files');
            } catch (SMF10_CaseFilesService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial message');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldDenyVersionData_WhenCallerHasNoCaseAccess() {
        ContentVersion image = versionByTitle(IMAGE_TITLE);
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            try {
                SMF10_CaseFilesService.getVersionWithData(image.Id);
                Assert.fail('MF-RESTRICTED stand-in must not retrieve MF-IMAGE-001');
            } catch (SMF10_CaseFilesService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial message');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldDenyNegativeControlFile_WhenTechRequestsIt() {
        ContentVersion denied = versionByTitle(DENIED_TITLE);
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            try {
                SMF10_CaseFilesService.getVersionWithData(denied.Id);
                Assert.fail('MF-TECH stand-in must not retrieve MF-FILE-DENIED');
            } catch (SMF10_CaseFilesService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial message');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldDenyNegativeControlCase_WhenTechListsIt() {
        Case restrictedCase = caseBySubjectPrefix('MF-CASE-002');
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            try {
                SMF10_CaseFilesService.listCaseFiles(restrictedCase.Id);
                Assert.fail('MF-TECH stand-in must not list MF-CASE-002 Files');
            } catch (SMF10_CaseFilesService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial message');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldThrowNotFound_WhenCaseIdNull() {
        Test.startTest();
        try {
            SMF10_CaseFilesService.listCaseFiles(null);
            Assert.fail('Null case Id must be rejected');
        } catch (SMF10_CaseFilesService.NotFoundException e) {
            Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform message');
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldMapContentTypes_WhenKnownAndUnknownExtensions() {
        Test.startTest();
        String png = SMF10_CaseFilesService.contentTypeFor('PNG');
        String jpeg = SMF10_CaseFilesService.contentTypeFor('jpeg');
        String json = SMF10_CaseFilesService.contentTypeFor('json');
        String other = SMF10_CaseFilesService.contentTypeFor('txt');
        Test.stopTest();
        Assert.areEqual('image/png', png, 'png');
        Assert.areEqual('image/jpeg', jpeg, 'jpeg');
        Assert.areEqual('application/json', json, 'json');
        Assert.areEqual('application/octet-stream', other, 'unknown types are opaque');
    }
}
