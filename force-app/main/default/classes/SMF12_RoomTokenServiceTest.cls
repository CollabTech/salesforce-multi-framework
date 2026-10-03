/**
 * Tests for SMF12_RoomTokenService / SMF12_RoomTokenResource: owner gets a token, a user
 * without case access is refused BEFORE any callout (SYNC-03), service errors map to 503.
 * Denials assume Case OWD Private (SMF-3 baseline).
 */
@IsTest
private class SMF12_RoomTokenServiceTest {

    private static final String TECH_ALIAS = 'smftech';
    private static final String RESTRICTED_ALIAS = 'smfrestr';

    /** Mock sync service: records calls, returns a canned token or an error status. */
    private class SyncServiceMock implements HttpCalloutMock {
        Integer status;
        Integer calls = 0;
        String lastBody;
        SyncServiceMock(Integer status) {
            this.status = status;
        }
        public HttpResponse respond(HttpRequest request) {
            calls++;
            lastBody = request.getBody();
            HttpResponse response = new HttpResponse();
            response.setStatusCode(status);
            response.setBody('{"token":"v1.test.sig","room":"mf-00000000000000000000000000000000","expiresAt":1,"wsUrl":"wss://sync.invalid"}');
            return response;
        }
    }

    @TestSetup
    static void setupTestData() {
        User tech = SMF10_TestDataFactory.createStandardUser(TECH_ALIAS);
        SMF10_TestDataFactory.createStandardUser(RESTRICTED_ALIAS);
        System.runAs(tech) {
            SMF10_TestDataFactory.createCase('MF-CASE-001 Pump overheating');
        }
    }

    private static User userByAlias(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias.left(8) LIMIT 1];
    }

    @IsTest
    static void shouldReturnToken_WhenOwnerRequests() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        SyncServiceMock mock = new SyncServiceMock(200);
        Test.setMock(HttpCalloutMock.class, mock);
        SMF12_RoomTokenService.TokenResponse token;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            token = SMF12_RoomTokenService.mintForCase(permitted.Id);
        }
        Test.stopTest();
        Assert.areEqual('v1.test.sig', token.token, 'Token passed through');
        Assert.areEqual(1, mock.calls, 'One mint callout');
        Assert.isTrue(mock.lastBody.contains(String.valueOf(permitted.Id)), 'Case Id bound into the mint request');
    }

    @IsTest
    static void shouldRefuseWithoutCallout_WhenCallerHasNoCaseAccess() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        SyncServiceMock mock = new SyncServiceMock(200);
        Test.setMock(HttpCalloutMock.class, mock);
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            try {
                SMF12_RoomTokenService.mintForCase(permitted.Id);
                Assert.fail('MF-RESTRICTED stand-in must not get a room token');
            } catch (SMF12_RoomTokenService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial');
            }
        }
        Test.stopTest();
        Assert.areEqual(0, mock.calls, 'No callout may happen for a denied user');
    }

    @IsTest
    static void shouldThrowServiceException_WhenSyncServiceRefuses() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new SyncServiceMock(503));
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            try {
                SMF12_RoomTokenService.mintForCase(permitted.Id);
                Assert.fail('Service refusal must surface');
            } catch (SMF12_RoomTokenService.ServiceException e) {
                Assert.isTrue(e.getMessage().contains('503'), 'Status reported');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldReturn404_WhenRestrictedCallsEndpoint() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new SyncServiceMock(200));
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf12/v1/cases/' + permitted.Id + '/room-token';
        req.httpMethod = 'POST';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            SMF12_RoomTokenResource.doPost();
        }
        Test.stopTest();
        Assert.areEqual(404, RestContext.response.statusCode, 'Denied as 404');
    }

    @IsTest
    static void shouldReturn200_WhenOwnerCallsEndpoint() {
        Case permitted = [SELECT Id FROM Case LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new SyncServiceMock(200));
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf12/v1/cases/' + permitted.Id + '/room-token';
        req.httpMethod = 'POST';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            SMF12_RoomTokenResource.doPost();
        }
        Test.stopTest();
        Assert.areEqual(200, RestContext.response.statusCode, 'Owner gets a token');
        Assert.areEqual('no-store', RestContext.response.headers.get('Cache-Control'), 'Token responses are not cached');
    }

    @IsTest
    static void shouldReturn404_WhenPathMalformed() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf12/v1/cases/bad/room-token';
        req.httpMethod = 'POST';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        SMF12_RoomTokenResource.doPost();
        Test.stopTest();
        Assert.areEqual(404, RestContext.response.statusCode, 'Malformed Id is a 404');
    }
}
