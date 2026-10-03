/**
 * SMF-7 CALL-03 server-side boundary tests (allow, deny, wrong case, provider error,
 * configuration, secret handling). Users mirror the SMF-3 persona baseline; the tests assume
 * the SMF-3 org baseline Case OWD = Private (testing/provisioning/baseline.json).
 * Note: a callout may not follow uncommitted DML, so a second issue in the same test is placed
 * after Test.startTest().
 */
@IsTest
private class SMF7_CallAuthServiceTest {
    private static final String CASE1 = 'Pump overheating — remote diagnosis';
    private static final String CASE2 = 'MF-CASE-002 restricted negative control (synthetic)';

    @TestSetup
    static void setup() {
        User tech;
        User support;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            tech = SMF7_TestDataFactory.createUser('mftech', true, true);
            support = SMF7_TestDataFactory.createUser('mfsupp', true, true);
            SMF7_TestDataFactory.createUser('mfrest', false, true);
            SMF7_TestDataFactory.createUser('mfnojn', true, false);
        }
        Case permitted = SMF7_TestDataFactory.createCase(tech.Id, CASE1);
        insert new CaseShare(CaseId = permitted.Id, UserOrGroupId = support.Id, CaseAccessLevel = 'Edit');
        SMF7_TestDataFactory.createCase(UserInfo.getUserId(), CASE2);
    }

    private static User persona(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias LIMIT 1];
    }

    private static Id caseId(String subject) {
        return [SELECT Id FROM Case WHERE Subject = :subject LIMIT 1].Id;
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

    private static SMF7_CallAuthService.Result issueAs(String alias, Id targetCase) {
        SMF7_CallAuthService.Result r;
        System.runAs(persona(alias)) {
            r = new SMF7_CallAuthService().issueToken(String.valueOf(targetCase));
        }
        return r;
    }

    @IsTest
    static void shouldIssueToken_WhenCallerCanReadCase() {
        SMF7_RealtimeKitMock mock = configure();
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.OK, r.code, 'TECH can read MF-CASE-001');
        Assert.areEqual(SMF7_RealtimeKitMock.TOKEN_NEW, r.authToken, 'participant token returned');
        Assert.areEqual(1, mock.count('/meetings'), 'one meeting created');
        Assert.areEqual(1, mock.count('/participants'), 'one participant added');
        Assert.areEqual(1, [SELECT COUNT() FROM SMF7_Call_Room__c], 'room persisted server-side');
        Assert.areEqual(SMF7_RealtimeKitMock.MEETING_ID, [SELECT MeetingId__c FROM SMF7_Call_Room__c LIMIT 1].MeetingId__c, 'meeting id stored');
    }

    @IsTest
    static void shouldRefreshNotDuplicate_WhenSameUserRequestsAgain() {
        SMF7_RealtimeKitMock mock = configure();
        issueAs('mftech', caseId(CASE1));
        Test.startTest();
        SMF7_CallAuthService.Result again = issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_RealtimeKitMock.TOKEN_REFRESHED, again.authToken, 'existing participant refreshed');
        Assert.areEqual(1, mock.count('/meetings'), 'meeting created once');
        Assert.areEqual(1, mock.count('/participants'), 'participant added once (no duplicate)');
        Assert.areEqual(1, [SELECT COUNT() FROM SMF7_Call_Participant__c], 'one participant row');
    }

    @IsTest
    static void shouldShareMeeting_WhenSupportJoinsSameCase() {
        SMF7_RealtimeKitMock mock = configure();
        issueAs('mftech', caseId(CASE1));
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mfsupp', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.OK, r.code, 'SUPPORT shares MF-CASE-001');
        Assert.areEqual(1, mock.count('/meetings'), 'same meeting reused');
        Assert.areEqual(2, [SELECT COUNT() FROM SMF7_Call_Participant__c], 'one participant per persona');
    }

    @IsTest
    static void shouldDeny_WhenCallerRequestsWrongCase() {
        SMF7_RealtimeKitMock mock = configure();
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mfsupp', caseId(CASE2));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.NO_CASE_ACCESS, r.code, 'MF-ROOM-002 denied');
        Assert.areEqual(403, r.httpStatus, 'forbidden');
        Assert.isNull(r.authToken, 'no token');
        Assert.areEqual(0, mock.requests.size(), 'no provider call before authorization');
    }

    @IsTest
    static void shouldDeny_WhenRestrictedHasNoCaseAccess() {
        SMF7_RealtimeKitMock mock = configure();
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mfrest', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.NO_CASE_ACCESS, r.code, 'RESTRICTED denied');
        Assert.isNull(r.authToken, 'no token');
        Assert.areEqual(0, mock.requests.size(), 'no provider call');
    }

    @IsTest
    static void shouldDeny_WhenJoinPermissionMissing() {
        SMF7_RealtimeKitMock mock = configure();
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mfnojn', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.NOT_PERMITTED, r.code, 'SMF7_Join_Call required');
        Assert.areEqual(0, mock.requests.size(), 'no provider call');
    }

    @IsTest
    static void shouldRejectInput_WhenIdIsNotACase() {
        configure();
        Test.startTest();
        SMF7_CallAuthService.Result r;
        System.runAs(persona('mftech')) {
            r = new SMF7_CallAuthService().issueToken(String.valueOf(UserInfo.getUserId()));
        }
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.INVALID_CASE, r.code, 'user id is not a case id');
    }

    @IsTest
    static void shouldRejectInput_WhenIdIsBlank() {
        configure();
        Test.startTest();
        SMF7_CallAuthService.Result r = new SMF7_CallAuthService().issueToken('');
        Test.stopTest();
        Assert.areEqual(400, r.httpStatus, 'blank id rejected');
    }

    @IsTest
    static void shouldReturnSanitizedError_WhenProviderFails() {
        SMF7_RealtimeKitMock mock = configure();
        mock.meetingStatus = 500;
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.PROVIDER_ERROR, r.code, 'provider error mapped');
        Assert.areEqual(502, r.httpStatus, 'bad gateway');
        Assert.isNull(r.authToken, 'no token');
        String serialized = JSON.serialize(r);
        Assert.isFalse(serialized.contains('SECRET') || serialized.contains('Bearer'), 'provider body never echoed');
        Assert.areEqual(0, [SELECT COUNT() FROM SMF7_Call_Room__c], 'nothing persisted');
    }

    @IsTest
    static void shouldReaddParticipant_WhenProviderNoLongerKnowsIt() {
        SMF7_RealtimeKitMock mock = configure();
        issueAs('mftech', caseId(CASE1));
        mock.refreshStatus = 404;
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_RealtimeKitMock.TOKEN_NEW, r.authToken, 're-added participant token');
        Assert.areEqual(2, mock.count('/participants'), 'participant added again');
        Assert.areEqual(1, [SELECT COUNT() FROM SMF7_Call_Participant__c], 'mapping updated, not duplicated');
    }

    @IsTest
    static void shouldReturnNotConfigured_WhenConfigMissing() {
        SMF7_RealtimeKitMock mock = configure();
        SMF7_CallAuthService.forceNotConfigured = true;
        Test.startTest();
        SMF7_CallAuthService.Result r = issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        Assert.areEqual(SMF7_CallAuthService.Code.NOT_CONFIGURED, r.code, 'not configured');
        Assert.areEqual(503, r.httpStatus, 'service unavailable');
        Assert.areEqual(0, mock.requests.size(), 'no provider call');
    }

    @IsTest
    static void shouldUseNamedCredentialOnly_WhenCallingProvider() {
        SMF7_RealtimeKitMock mock = configure();
        Test.startTest();
        issueAs('mftech', caseId(CASE1));
        Test.stopTest();
        for (HttpRequest req : mock.requests) {
            Assert.isTrue(req.getEndpoint().startsWith('callout:SMF7_Cloudflare/accounts/acct-test/realtime/kit/app-test/'), 'named credential endpoint');
            Assert.isNull(req.getHeader('Authorization'), 'Apex never sets the API token');
            Assert.isFalse((req.getBody() ?? '').contains('@'), 'no email or username sent to the provider');
        }
    }

    @IsTest
    static void shouldReportOk_WhenConfigurationCheckFindsPreset() {
        configure();
        Test.startTest();
        String status = SMF7_CallAuthService.checkConfiguration();
        Test.stopTest();
        Assert.areEqual('OK', status, 'preset present');
    }

    @IsTest
    static void shouldReportProviderStatus_WhenConfigurationCheckUnauthorized() {
        SMF7_RealtimeKitMock mock = configure();
        mock.presetStatus = 401;
        Test.startTest();
        String status = SMF7_CallAuthService.checkConfiguration();
        Test.stopTest();
        Assert.areEqual('PROVIDER_ERROR_401', status, 'missing/invalid External Credential secret detected');
    }
}
