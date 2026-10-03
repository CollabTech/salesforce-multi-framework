/**
 * Tests for SMF11_MarkupResource status codes. The POST path takes ContentBody Ids, which
 * tests cannot mint, so success/conflict logic is covered in SMF11_MarkupServiceTest; here
 * the routing, 400/404 and the GET of an existing revision are checked.
 */
@IsTest
private class SMF11_MarkupResourceTest {

    private static final String TECH_ALIAS = 'smftech';
    private static final String RESTRICTED_ALIAS = 'smfrestr';

    @TestSetup
    static void setupTestData() {
        User tech = SMF10_TestDataFactory.createStandardUser(TECH_ALIAS);
        SMF10_TestDataFactory.createStandardUser(RESTRICTED_ALIAS);
        System.runAs(tech) {
            Case permitted = SMF10_TestDataFactory.createCase('MF-CASE-001 Pump overheating');
            ContentVersion image = SMF10_TestDataFactory.createImageVersion(permitted.Id, 'MF-IMAGE-001', null);
            SMF11_MarkupService.save(permitted.Id, null, 'save-key-0001', image.Id,
                new SMF11_MarkupService.Source(null, Blob.valueOf('{}')),
                new SMF11_MarkupService.Source(null, Blob.valueOf('png')));
        }
    }

    private static User userByAlias(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias.left(8) LIMIT 1];
    }

    private static RestResponse call(String method, String path, String body) {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf11/v1/' + path;
        req.httpMethod = method;
        req.requestBody = body == null ? null : Blob.valueOf(body);
        RestContext.request = req;
        RestContext.response = new RestResponse();
        if (method == 'GET') {
            SMF11_MarkupResource.doGet();
        } else {
            SMF11_MarkupResource.doPost();
        }
        return RestContext.response;
    }

    @IsTest
    static void shouldReturnRevision_WhenTechReadsMarkup() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            res = call('GET', 'cases/' + permitted.Id + '/markup', null);
        }
        Test.stopTest();
        Assert.areEqual(200, res.statusCode, 'Owner can read markup');
        Assert.isTrue(res.responseBody.toString().contains('"rev":1'), 'Revision 1 returned');
    }

    @IsTest
    static void shouldReturn404_WhenRestrictedReadsMarkup() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            res = call('GET', 'cases/' + permitted.Id + '/markup', null);
        }
        Test.stopTest();
        Assert.areEqual(404, res.statusCode, 'Hidden case must be 404');
    }

    @IsTest
    static void shouldReturn409_WhenBaseIsStale() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        Id imageId = [SELECT Id FROM ContentVersion WHERE Title = 'MF-IMAGE-001' LIMIT 1].Id;
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            res = call('POST', 'cases/' + permitted.Id + '/markup', JSON.serialize(new Map<String, String>{
                'saveKey' => 'save-key-0002', 'imageVersionId' => imageId,
                'snapshotBodyId' => 'unused', 'exportBodyId' => 'unused' }));
        }
        Test.stopTest();
        Assert.areEqual(409, res.statusCode, 'A null base after revision 1 exists is a conflict');
    }

    @IsTest
    static void shouldReturn400_WhenPathMalformed() {
        Test.startTest();
        RestResponse res = call('GET', 'cases/bad/markup', null);
        Test.stopTest();
        Assert.areEqual(400, res.statusCode, 'Malformed Id must be 400');
    }

    @IsTest
    static void shouldReturn400_WhenJsonMalformed() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        RestResponse res;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            res = call('POST', 'cases/' + permitted.Id + '/markup', '{not json');
        }
        Test.stopTest();
        Assert.areEqual(400, res.statusCode, 'Malformed JSON must be 400');
    }
}
