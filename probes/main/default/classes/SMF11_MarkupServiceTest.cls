/**
 * Tests for SMF11_MarkupService: first save, revision association, conflict detection
 * (no silent overwrite), idempotent retry, image-must-belong-to-case, and denial for a user
 * without case access (MARK-04). Uses inline data instead of uploaded ContentBody Ids.
 * Denials assume Case OWD Private (SMF-3 baseline).
 */
@IsTest
private class SMF11_MarkupServiceTest {

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
            Case other = SMF10_TestDataFactory.createCase('MF-CASE-OTHER owned by tech');
            SMF10_TestDataFactory.createImageVersion(other.Id, 'OTHER-IMAGE', null);
        }
    }

    private static User userByAlias(String alias) {
        return [SELECT Id FROM User WHERE Alias = :alias.left(8) LIMIT 1];
    }

    private static Case permittedCase() {
        return [SELECT Id FROM Case WHERE Subject LIKE 'MF-CASE-001%' LIMIT 1];
    }

    private static Id imageVersionId(String title) {
        return [SELECT Id FROM ContentVersion WHERE Title = :title LIMIT 1].Id;
    }

    private static SMF11_MarkupService.Source inline(String text) {
        return new SMF11_MarkupService.Source(null, Blob.valueOf(text));
    }

    private static SMF11_MarkupService.Revision saveAs(Id baseId, String key) {
        return SMF11_MarkupService.save(permittedCase().Id, baseId, key, imageVersionId(IMAGE_TITLE),
            inline('{"document":{}}'), inline('png-bytes'));
    }

    @IsTest
    static void shouldCreateRevisionOne_WhenFirstSave() {
        SMF11_MarkupService.Revision rev;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            rev = saveAs(null, 'save-key-0001');
        }
        Test.stopTest();
        Assert.areEqual(1, rev.rev, 'First save is revision 1');
        ContentVersion export = [SELECT Description FROM ContentVersion WHERE Id = :rev.exportVersionId];
        Assert.isTrue(export.Description.contains('snapshot=' + rev.snapshotVersionId), 'Export must reference its snapshot');
    }

    @IsTest
    static void shouldReturnLatestWithExport_WhenReopened() {
        SMF11_MarkupService.Revision latest;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            SMF11_MarkupService.Revision first = saveAs(null, 'save-key-0001');
            saveAs(first.snapshotVersionId, 'save-key-0002');
            latest = SMF11_MarkupService.latestRevision(permittedCase().Id);
        }
        Test.stopTest();
        Assert.areEqual(2, latest.rev, 'Latest revision is 2');
        Assert.isNotNull(latest.exportVersionId, 'Export must be associated');
        Assert.areEqual('save-key-0002', latest.saveKey, 'Save key round-trips');
    }

    @IsTest
    static void shouldThrowConflict_WhenBaseIsStale() {
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            SMF11_MarkupService.Revision first = saveAs(null, 'save-key-0001');
            saveAs(first.snapshotVersionId, 'save-key-0002');
            try {
                saveAs(first.snapshotVersionId, 'save-key-0003');
                Assert.fail('A save based on a stale revision must conflict');
            } catch (SMF11_MarkupService.ConflictException e) {
                Assert.areEqual(2, e.current.rev, 'Conflict reports the current revision');
            }
        }
        Test.stopTest();
        Integer snapshots = [SELECT COUNT() FROM ContentVersion WHERE Title LIKE 'MF-MARKUP-001 snapshot r%'];
        Assert.areEqual(2, snapshots, 'The conflicting save must not write anything');
    }

    @IsTest
    static void shouldThrowConflict_WhenFirstSaveRacesAnother() {
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            saveAs(null, 'save-key-0001');
            try {
                saveAs(null, 'save-key-0002');
                Assert.fail('Second "first save" must conflict');
            } catch (SMF11_MarkupService.ConflictException e) {
                Assert.areEqual(1, e.current.rev, 'Conflict reports revision 1');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldReturnExisting_WhenSameSaveKeyRetried() {
        SMF11_MarkupService.Revision first;
        SMF11_MarkupService.Revision retry;
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            first = saveAs(null, 'save-key-0001');
            retry = saveAs(null, 'save-key-0001');
        }
        Test.stopTest();
        Assert.isTrue(retry.reused, 'Retry must reuse the committed revision');
        Assert.areEqual(first.snapshotVersionId, retry.snapshotVersionId, 'Same snapshot version');
        Integer snapshots = [SELECT COUNT() FROM ContentVersion WHERE Title LIKE 'MF-MARKUP-001 snapshot r%'];
        Assert.areEqual(1, snapshots, 'Retry must not duplicate');
    }

    @IsTest
    static void shouldRejectImage_WhenLinkedToAnotherCase() {
        Test.startTest();
        System.runAs(userByAlias(TECH_ALIAS)) {
            try {
                SMF11_MarkupService.save(permittedCase().Id, null, 'save-key-0001', imageVersionId('OTHER-IMAGE'),
                    inline('{}'), inline('png'));
                Assert.fail('Image from another case must be rejected');
            } catch (SMF11_MarkupService.BadRequestException e) {
                Assert.isTrue(e.getMessage().contains('not linked'), 'Explains the rejection');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldDenySave_WhenCallerHasNoCaseAccess() {
        Id caseId = permittedCase().Id;
        Id imageId = imageVersionId(IMAGE_TITLE);
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            try {
                SMF11_MarkupService.save(caseId, null, 'save-key-0001', imageId, inline('{}'), inline('png'));
                Assert.fail('MF-RESTRICTED stand-in must not save markup');
            } catch (SMF11_MarkupService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldDenyMarkupAndFiles_WhenRestrictedReads() {
        SMF11_MarkupService.Revision rev;
        System.runAs(userByAlias(TECH_ALIAS)) {
            rev = saveAs(null, 'save-key-0001');
        }
        Id caseId = permittedCase().Id;
        Test.startTest();
        System.runAs(userByAlias(RESTRICTED_ALIAS)) {
            try {
                SMF11_MarkupService.latestRevision(caseId);
                Assert.fail('MF-RESTRICTED stand-in must not read markup');
            } catch (SMF11_MarkupService.NotFoundException e) {
                Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial');
            }
            for (String versionId : new List<String>{ rev.snapshotVersionId, rev.exportVersionId, rev.imageVersionId }) {
                try {
                    SMF10_CaseFilesService.getVersionWithData(versionId);
                    Assert.fail('MF-RESTRICTED stand-in must not retrieve image, snapshot or export');
                } catch (SMF10_CaseFilesService.NotFoundException e) {
                    Assert.areEqual(SMF10_CaseFilesService.NOT_FOUND_MESSAGE, e.getMessage(), 'Uniform denial');
                }
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldParseMeta_WhenWellFormed() {
        Test.startTest();
        Map<String, String> meta = SMF11_MarkupService.parseMeta('smf11;kind=export;rev=3;save=k;snapshot=x');
        Map<String, String> none = SMF11_MarkupService.parseMeta('free text');
        Test.stopTest();
        Assert.areEqual('3', meta.get('rev'), 'rev parsed');
        Assert.isTrue(none.isEmpty(), 'Non-SMF-11 descriptions are ignored');
    }
}
