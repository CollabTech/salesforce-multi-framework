/**
 * SMF7_AccessSweep: participants whose case access or join permission is gone are deleted at
 * RealtimeKit and unmapped; authorized participants are left alone (finding A1, CALL-03).
 */
@IsTest
private class SMF7_AccessSweepTest {
    private static final String CASE1 = 'Pump overheating — remote diagnosis';

    @TestSetup
    static void setup() {
        User tech;
        User support;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            tech = SMF7_TestDataFactory.createUser('swtech', true, true);
            support = SMF7_TestDataFactory.createUser('swsupp', true, true);
        }
        Case c = SMF7_TestDataFactory.createCase(tech.Id, CASE1);
        insert new CaseShare(CaseId = c.Id, UserOrGroupId = support.Id, CaseAccessLevel = 'Edit');
        SMF7_Call_Room__c room = new SMF7_Call_Room__c(Case__c = c.Id, CaseKey__c = String.valueOf(c.Id), MeetingId__c = 'meeting-sweep');
        insert room;
        insert new List<SMF7_Call_Participant__c>{
            new SMF7_Call_Participant__c(Room__c = room.Id, User__c = tech.Id, ParticipantId__c = 'p-tech',
                UniqueKey__c = SMF7_CallRoomStore.participantKey(c.Id, tech.Id)),
            new SMF7_Call_Participant__c(Room__c = room.Id, User__c = support.Id, ParticipantId__c = 'p-supp',
                UniqueKey__c = SMF7_CallRoomStore.participantKey(c.Id, support.Id))
        };
    }

    private static User persona(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias LIMIT 1];
    }

    private static SMF7_RealtimeKitMock configure() {
        SMF7_RealtimeKitClient.Config cfg = new SMF7_RealtimeKitClient.Config();
        cfg.accountId = 'acct-test';
        cfg.appId = 'app-test';
        cfg.presetName = 'group_call_host';
        SMF7_CallAuthService.configOverride = cfg;
        SMF7_RealtimeKitMock mock = new SMF7_RealtimeKitMock();
        Test.setMock(HttpCalloutMock.class, mock);
        return mock;
    }

    private static Set<String> remainingParticipants() {
        Set<String> ids = new Set<String>();
        for (SMF7_Call_Participant__c p : [SELECT ParticipantId__c FROM SMF7_Call_Participant__c]) {
            ids.add(p.ParticipantId__c);
        }
        return ids;
    }

    private static void sweep() {
        Test.startTest();
        System.enqueueJob(new SMF7_AccessSweep());
        Test.stopTest();
    }

    @IsTest
    static void shouldKeepParticipants_WhenAccessUnchanged() {
        SMF7_RealtimeKitMock mock = configure();
        sweep();
        Assert.areEqual(0, mock.deletes(), 'no revocation for authorized users');
        Assert.areEqual(new Set<String>{ 'p-tech', 'p-supp' }, remainingParticipants());
    }

    @IsTest
    static void shouldRevoke_WhenJoinPermissionRemoved() {
        SMF7_RealtimeKitMock mock = configure();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            delete [SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = :persona('swsupp').Id AND PermissionSet.Name = 'SMF7_Access'];
        }
        sweep();
        Assert.areEqual(1, mock.deletes(), 'exactly the unauthorized participant is deleted at the provider');
        Assert.isTrue(mock.requests[0].getEndpoint().endsWith('/participants/p-supp'), 'targets the support participant');
        Assert.areEqual(new Set<String>{ 'p-tech' }, remainingParticipants());
    }

    @IsTest
    static void shouldRevoke_WhenCaseSharingRemoved() {
        SMF7_RealtimeKitMock mock = configure();
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :persona('swsupp').Id AND RowCause = 'Manual'];
        sweep();
        Assert.areEqual(1, mock.deletes());
        Assert.areEqual(new Set<String>{ 'p-tech' }, remainingParticipants());
    }

    @IsTest
    static void shouldRevoke_WhenUserDeactivated() {
        SMF7_RealtimeKitMock mock = configure();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            update new User(Id = persona('swsupp').Id, IsActive = false);
        }
        sweep();
        Assert.areEqual(1, mock.deletes());
        Assert.areEqual(new Set<String>{ 'p-tech' }, remainingParticipants());
    }

    @IsTest
    static void shouldKeepMapping_WhenProviderDeleteFails() {
        SMF7_RealtimeKitMock mock = configure();
        mock.deleteStatus = 500;
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :persona('swsupp').Id AND RowCause = 'Manual'];
        sweep();
        Assert.areEqual(1, mock.deletes(), 'attempted');
        Assert.areEqual(new Set<String>{ 'p-tech', 'p-supp' }, remainingParticipants(), 'kept for the next run');
    }

    @IsTest
    static void shouldDoNothing_WhenNotConfigured() {
        SMF7_RealtimeKitMock mock = new SMF7_RealtimeKitMock();
        Test.setMock(HttpCalloutMock.class, mock);
        SMF7_CallAuthService.forceNotConfigured = true;
        delete [SELECT Id FROM CaseShare WHERE UserOrGroupId = :persona('swsupp').Id AND RowCause = 'Manual'];
        sweep();
        Assert.areEqual(0, mock.requests.size());
        Assert.areEqual(2, remainingParticipants().size());
    }

    @IsTest
    static void shouldScheduleAndStop() {
        Test.startTest();
        Integer scheduled = SMF7_AccessSweep.start(15);
        Integer stopped = SMF7_AccessSweep.stop();
        Test.stopTest();
        Assert.areEqual(4, scheduled, 'minutes 0, 15, 30, 45');
        Assert.areEqual(4, stopped);
    }
}
