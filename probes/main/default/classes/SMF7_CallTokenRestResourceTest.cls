/**
 * SMF-7 REST layer tests: status codes, response shape, no-store, and that only the
 * participant token (never provider ids or the API token) leaves the endpoint.
 */
@IsTest
private class SMF7_CallTokenRestResourceTest {
    private static final String SUBJECT = 'Pump overheating — remote diagnosis';

    @TestSetup
    static void setup() {
        User tech;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            tech = SMF7_TestDataFactory.createUser('mftech', true, true);
            SMF7_TestDataFactory.createUser('mfrest', false, true);
        }
        SMF7_TestDataFactory.createCase(tech.Id, SUBJECT);
    }

    private static SMF7_RealtimeKitMock configure() {
        SMF7_RealtimeKitClient.Config c = new SMF7_RealtimeKitClient.Config();
        c.accountId = 'acct-test';
        c.appId = 'app-test';
        c.presetName = 'group_call_host';
        SMF7_CallAuthService.configOverride = c;
        SMF7_RealtimeKitMock mock = new SMF7_RealtimeKitMock();
        Test.setMock(HttpCalloutMock.class, mock);
        return mock;
    }

    private static SMF7_CallTokenRestResource.ApiResponse post(String alias, String body) {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/smf7/v1/call-token';
        req.httpMethod = 'POST';
        req.requestBody = body == null ? null : Blob.valueOf(body);
        RestContext.request = req;
        RestContext.response = new RestResponse();
        SMF7_CallTokenRestResource.ApiResponse out;
        System.runAs([SELECT Id FROM User WHERE Alias = :alias AND Username LIKE 'smf7.%' LIMIT 1][0]) {
            out = SMF7_CallTokenRestResource.issue();
        }
        return out;
    }

    @IsTest
    static void shouldReturnOnlyParticipantToken_WhenAuthorized() {
        configure();
        Id caseId = [SELECT Id FROM Case WHERE Subject = :SUBJECT LIMIT 1].Id;
        Test.startTest();
        SMF7_CallTokenRestResource.ApiResponse out = post('mftech', JSON.serialize(new Map<String, String>{ 'caseId' => caseId }));
        Test.stopTest();
        Assert.areEqual(200, RestContext.response.statusCode, 'ok');
        Assert.isTrue(out.success, 'success');
        Assert.areEqual(SMF7_RealtimeKitMock.TOKEN_NEW, out.authToken, 'participant token');
        String serialized = JSON.serialize(out);
        Assert.isFalse(serialized.contains(SMF7_RealtimeKitMock.MEETING_ID), 'meeting id not exposed');
        Assert.isFalse(serialized.contains(SMF7_RealtimeKitMock.PARTICIPANT_ID), 'participant id not exposed');
        Assert.isFalse(serialized.contains('acct-test') || serialized.contains('app-test'), 'account/app ids not exposed');
        Assert.areEqual('no-store', RestContext.response.headers.get('Cache-Control'), 'not cacheable');
    }

    @IsTest
    static void shouldReturn403_WhenRestrictedCallsEndpoint() {
        SMF7_RealtimeKitMock mock = configure();
        Id caseId = [SELECT Id FROM Case WHERE Subject = :SUBJECT LIMIT 1].Id;
        Test.startTest();
        SMF7_CallTokenRestResource.ApiResponse out = post('mfrest', JSON.serialize(new Map<String, String>{ 'caseId' => caseId }));
        Test.stopTest();
        Assert.areEqual(403, RestContext.response.statusCode, 'forbidden');
        Assert.areEqual('NO_CASE_ACCESS', out.code, 'denied code');
        Assert.isNull(out.authToken, 'no token');
        Assert.areEqual(0, mock.requests.size(), 'no provider call');
    }

    @IsTest
    static void shouldReturn400_WhenBodyIsMalformed() {
        configure();
        Test.startTest();
        SMF7_CallTokenRestResource.ApiResponse out = post('mftech', '{not json');
        Test.stopTest();
        Assert.areEqual(400, RestContext.response.statusCode, 'bad request');
        Assert.areEqual('INVALID_REQUEST', out.code, 'invalid request');
    }

    @IsTest
    static void shouldReturn400_WhenBodyIsMissing() {
        configure();
        Test.startTest();
        SMF7_CallTokenRestResource.ApiResponse out = post('mftech', null);
        Test.stopTest();
        Assert.areEqual(400, RestContext.response.statusCode, 'bad request');
        Assert.areEqual('INVALID_CASE', out.code, 'no case id');
    }
}
