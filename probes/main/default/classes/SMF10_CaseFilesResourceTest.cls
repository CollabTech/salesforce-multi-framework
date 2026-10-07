/**
 * Tests for SMF10_CaseFilesResource routing, status codes and denial responses.
 * Denials assume Case OWD Private (SMF-3 baseline; see SMF10_TestDataFactory).
 */
@IsTest
private class SMF10_CaseFilesResourceTest {

    private static final String TECH_ALIAS = 'smftech';
    private static final String RESTRICTED_ALIAS = 'smfrestr';
    private static final String IMAGE_TITLE = 'MF-IMAGE-001';

    @TestSetup
    static void setupTestData() {
        User tech = SMF10_TestDataFactory.createStandardUser(TECH_ALIAS);
        SMF10_TestDataFactory.createStandardUser(RESTRICTED_ALIAS);
        System.runAs(tech) {
            Case permitted = SMF10_TestDataFactory.createCase('MF-CASE-001 Pump overheating');
            SMF10_TestDataFactory.createImageVersion(permitted.Id, IMAGE_TITLE, null);
        }
    }

    private static User userByAlias(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias.left(8) LIMIT 1];
    }

    private static RestResponse callGet(String path) {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf10/v1/' + path;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        SMF10_CaseFilesResource.doGet();
        return RestContext.response;
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
    static void shouldReturn200WithFiles_WhenOwnerListsCase() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            res = callGet('cases/' + permitted.Id + '/files');
        }
        Test.stopTest();
        Assert.areEqual(200, res.statusCode, 'Owner list should succeed');
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.responseBody.toString());
        Assert.areEqual(1, ((List<Object>) body.get('files')).size(), 'One linked File expected');
    }

    @IsTest
    static void shouldReturnBytes_WhenOwnerReadsVersion() {
        ContentVersion image = visibleVersions(IMAGE_TITLE)[0];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            res = callGet('versions/' + image.Id + '/data');
        }
        Test.stopTest();
        Assert.areEqual(200, res.statusCode, 'Owner read should succeed');
        Assert.areEqual(SMF10_TestDataFactory.PNG_BASE64, EncodingUtil.base64Encode(res.responseBody),
            'Raw bytes expected');
    }

    @IsTest
    static void shouldReturn404_WhenRestrictedReadsVersion() {
        ContentVersion image = visibleVersions(IMAGE_TITLE)[0];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            res = callGet('versions/' + image.Id + '/data');
        }
        Test.stopTest();
        Assert.areEqual(404, res.statusCode, 'Hidden version must be 404');
        Assert.isTrue(res.responseBody.toString().contains(SMF10_CaseFilesService.NOT_FOUND_MESSAGE),
            'Uniform denial message expected');
    }

    @IsTest
    static void shouldReturn404_WhenRestrictedListsCase() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            res = callGet('cases/' + permitted.Id + '/files');
        }
        Test.stopTest();
        Assert.areEqual(404, res.statusCode, 'Hidden case must be 404');
    }

    @IsTest
    static void shouldReturn400_WhenIdMalformed() {
        Test.startTest();
        RestResponse res = callGet('cases/not-an-id/files');
        Test.stopTest();
        Assert.areEqual(400, res.statusCode, 'Malformed Id must be 400');
    }

    @IsTest
    static void shouldReturn404_WhenPathUnknown() {
        Test.startTest();
        RestResponse res = callGet('unknown');
        Test.stopTest();
        Assert.areEqual(404, res.statusCode, 'Unknown path must be 404');
    }
}
