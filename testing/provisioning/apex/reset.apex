// SMF-3 reset (DATA-04). Deletes ONLY records that carry an SMF-3 fixture key; touches no
// other record, and never users (personas are reconciled by personas.py --reconcile).
// Run as MF-ADMIN, then reseed to restore the known fixture state:
//   python3 testing/provisioning/fixtures.py reset --target-org <alias> [--reseed]
// or alone: sf apex run --file testing/provisioning/apex/reset.apex --target-org <alias>
//
// Safety: aborts without deleting anything if MF-ACCOUNT-001 has child records that are not
// fixtures (cases, assets, contacts, opportunities), because deleting the account would cascade.
// Files linked to the fixture cases that are not fixture Files (e.g. uploads made by later
// stories) are reported, not deleted.

final String ACCOUNT_NAME = 'CollabTech PoC Test Customer';
final Set<String> CASE_SUBJECTS = new Set<String>{
    'Pump overheating — remote diagnosis',
    'MF-CASE-002 restricted negative control (synthetic)'
};
final Set<String> ASSET_SERIALS = new Set<String>{ 'MF-ASSET-001', 'MF-ASSET-002' };
final Set<String> FILE_TITLES = new Set<String>{ 'MF-IMAGE-001', 'MF-FILE-DENIED' };
Id adminId = UserInfo.getUserId();

List<Account> accs = [SELECT Id FROM Account WHERE Name = :ACCOUNT_NAME];
Set<Id> accIds = new Map<Id, Account>(accs).keySet();
List<Case> cases = [SELECT Id FROM Case WHERE Subject IN :CASE_SUBJECTS AND AccountId IN :accIds];
List<Asset> assets = [SELECT Id FROM Asset WHERE SerialNumber IN :ASSET_SERIALS];

Integer foreignCases = [SELECT COUNT() FROM Case WHERE AccountId IN :accIds AND Subject NOT IN :CASE_SUBJECTS];
Integer foreignAssets = [SELECT COUNT() FROM Asset WHERE AccountId IN :accIds AND SerialNumber NOT IN :ASSET_SERIALS];
Integer foreignContacts = [SELECT COUNT() FROM Contact WHERE AccountId IN :accIds];
Integer foreignOpps = [SELECT COUNT() FROM Opportunity WHERE AccountId IN :accIds];
Integer foreignAssetParents = [SELECT COUNT() FROM Asset WHERE SerialNumber IN :ASSET_SERIALS AND AccountId NOT IN :accIds];
if (foreignCases + foreignAssets + foreignContacts + foreignOpps + foreignAssetParents > 0) {
    System.debug('MF|RESET|ABORT non-fixture records attached to fixtures: cases=' + foreignCases + ' assets=' + foreignAssets
        + ' contacts=' + foreignContacts + ' opportunities=' + foreignOpps + ' fixture-assets-elsewhere=' + foreignAssetParents
        + ' (nothing deleted; resolve manually)');
} else {

    Set<Id> caseIds = new Map<Id, Case>(cases).keySet();
    List<ContentVersion> fixtureVersions = [SELECT ContentDocumentId FROM ContentVersion
                                            WHERE Title IN :FILE_TITLES AND IsLatest = true AND OwnerId = :adminId];
    Set<Id> fixtureDocs = new Set<Id>();
    for (ContentVersion v : fixtureVersions) { fixtureDocs.add(v.ContentDocumentId); }
    if (!caseIds.isEmpty()) {
        Integer otherFiles = 0;
        for (ContentDocumentLink l : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId IN :caseIds]) {
            if (!fixtureDocs.contains(l.ContentDocumentId)) { otherFiles++; }
        }
        System.debug('MF|RESET|non-fixture Files linked to fixture cases (kept, links removed with the cases)=' + otherFiles);
    }

    List<ContentDocument> docs = [SELECT Id FROM ContentDocument WHERE Id IN :fixtureDocs];
    delete docs;
    delete cases;
    delete assets;
    delete accs;
    System.debug('MF|RESET|deleted files=' + docs.size() + ' cases=' + cases.size() + ' assets=' + assets.size()
        + ' accounts=' + accs.size() + ' (manual shares and links go with their records)');
}
