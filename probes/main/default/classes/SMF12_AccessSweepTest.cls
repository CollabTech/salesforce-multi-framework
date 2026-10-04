/**
 * SMF12_AccessSweep / SMF12_RoomGrantStore (finding A2, SYNC-03): a grant whose holder lost case
 * edit access, SMF12_Access or activation triggers exactly one /revoke for that (user, case);
 * authorized holders are left alone; a refused revoke keeps the grant for the next run;
 * expired grants are dropped without a callout.
 */
@IsTest
private class SMF12_AccessSweepTest {

    /** Mock sync service: counts /revoke and /mint calls, answers with a fixed status. */
    private class SyncMock implements HttpCalloutMock {
        Integer status = 200;
        List<HttpRequest> revokes = new List<HttpRequest>();
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            if (request.getEndpoint().endsWith('/revoke')) {
                revokes.add(request);
                response.setStatusCode(status);
                response.setBody('{"revokedAt":1,"closed":1}');
            } else {
                response.setStatusCode(200);
                response.setBody('{"token":"v1.test.sig","room":"mf-00000000000000000000000000000000","expiresAt":'
                    + (System.now().getTime() / 1000 + 300) + ',"wsUrl":"wss://sync.invalid"}');
            }
            return response;
        }
    }

    @TestSetup
    static void setup() {
        User tech;
        User support;
        System.runAs(new User(Id = UserInfo.getUserId())) { // setup-object DML isolated from Case/CaseShare (mixed DML)
            tech = SMF10_TestDataFactory.createStandardUser('s12tech');
            support = SMF10_TestDataFactory.createStandardUser('s12supp');
            PermissionSet access = [SELECT Id FROM PermissionSet WHERE Name = 'SMF12_Access' LIMIT 1];
            insert new List<PermissionSetAssignment>{
                new PermissionSetAssignment(AssigneeId = tech.Id, PermissionSetId = access.Id),
                new PermissionSetAssignment(AssigneeId = support.Id, PermissionSetId = access.Id)
            };
        }
        Case c;
        System.runAs(tech) {
            c = SMF10_TestDataFactory.createCase('MF-CASE-001 Pump overheating');
        }
        insert new CaseShare(CaseId = c.Id, UserOrGroupId = support.Id, CaseAccessLevel = 'Edit');
        DateTime later = System.now().addMinutes(5);
        insert new List<SMF12_Room_Grant__c>{
            new SMF12_Room_Grant__c(Case__c = c.Id, User__c = tech.Id, ExpiresAt__c = later,
                UniqueKey__c = SMF12_RoomGrantStore.key(c.Id, tech.Id)),
            new SMF12_Room_Grant__c(Case__c = c.Id, User__c = support.Id, ExpiresAt__c = later,
                UniqueKey__c = SMF12_RoomGrantStore.key(c.Id, support.Id))
        };
    }

    private static User persona(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias LIMIT 1];
    }

    private static Set<Id> grantHolders() {
        Set<Id> ids = new Set<Id>();
        for (SMF12_Room_Grant__c g : [SELECT User__c FROM SMF12_Room_Grant__c]) {
            ids.add(g.User__c);
        }
        return ids;
    }

    private static SyncMock sweep(Integer status) {
        SyncMock mock = new SyncMock();
        mock.status = status;
        Test.setMock(HttpCalloutMock.class, mock);
        Test.startTest();
        System.enqueueJob(new SMF12_AccessSweep());
        Test.stopTest();
        return mock;
    }

    @IsTest
    static void shouldKeepGrants_WhenAccessUnchanged() {
        SyncMock mock = sweep(200);
        Assert.areEqual(0, mock.revokes.size(), 'no revocation for authorized users');
        Assert.areEqual(new Set<Id>{ persona('s12tech').Id, persona('s12supp').Id }, grantHolders());
    }

    @IsTest
    static void shouldRevoke_WhenCaseSharingRemoved() {
        Id support = persona('s12supp').Id;
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :support AND RowCause = 'Manual'];
        SyncMock mock = sweep(200);
        Assert.areEqual(1, mock.revokes.size(), 'exactly the holder who lost case access');
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(mock.revokes[0].getBody());
        Assert.areEqual(String.valueOf(support), body.get('userId'));
        Assert.isTrue(mock.revokes[0].getEndpoint().startsWith('callout:SMF12_MarkupSync/'), 'through the Named Credential');
        Assert.areEqual(new Set<Id>{ persona('s12tech').Id }, grantHolders());
    }

    @IsTest
    static void shouldRevoke_WhenTokenPermissionRemoved() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            delete [SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = :persona('s12supp').Id AND PermissionSet.Name = 'SMF12_Access'];
        }
        SyncMock mock = sweep(200);
        Assert.areEqual(1, mock.revokes.size());
        Assert.areEqual(new Set<Id>{ persona('s12tech').Id }, grantHolders());
    }

    @IsTest
    static void shouldRevoke_WhenUserDeactivated() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            update new User(Id = persona('s12supp').Id, IsActive = false);
        }
        SyncMock mock = sweep(200);
        Assert.areEqual(1, mock.revokes.size());
        Assert.areEqual(new Set<Id>{ persona('s12tech').Id }, grantHolders());
    }

    @IsTest
    static void shouldKeepGrant_WhenServiceRefusesRevoke() {
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :persona('s12supp').Id AND RowCause = 'Manual'];
        SyncMock mock = sweep(503);
        Assert.areEqual(1, mock.revokes.size(), 'attempted');
        Assert.areEqual(2, grantHolders().size(), 'kept for the next run');
    }

    @IsTest
    static void shouldDropExpiredGrantsWithoutCallout() {
        update new SMF12_Room_Grant__c(Id = [SELECT Id FROM SMF12_Room_Grant__c WHERE User__c = :persona('s12supp').Id].Id,
            ExpiresAt__c = System.now().addMinutes(-1));
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :persona('s12supp').Id AND RowCause = 'Manual'];
        SyncMock mock = sweep(200);
        Assert.areEqual(0, mock.revokes.size(), 'an expired token cannot connect; nothing to push');
        Assert.areEqual(new Set<Id>{ persona('s12tech').Id }, grantHolders());
    }

    @IsTest
    static void shouldRecordGrant_WhenTokenMinted() {
        Id support = persona('s12supp').Id;
        delete [SELECT Id FROM SMF12_Room_Grant__c WHERE User__c = :support];
        Case c = [SELECT Id FROM Case LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new SyncMock());
        Test.startTest();
        System.runAs(new User(Id = support)) {
            SMF12_RoomTokenService.mintForCase(c.Id);
        }
        Test.stopTest();
        SMF12_Room_Grant__c g = [SELECT Case__c, ExpiresAt__c FROM SMF12_Room_Grant__c WHERE User__c = :support];
        Assert.areEqual(c.Id, g.Case__c);
        Assert.isTrue(g.ExpiresAt__c > System.now(), 'expiry from the minted token');
    }

    @IsTest
    static void shouldScheduleAndStop() {
        Test.startTest();
        Integer scheduled = SMF12_AccessSweep.start(15);
        Integer stopped = SMF12_AccessSweep.stop();
        Test.stopTest();
        Assert.areEqual(4, scheduled, 'minutes 0, 15, 30, 45');
        Assert.areEqual(4, stopped);
    }
}
