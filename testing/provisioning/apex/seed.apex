// SMF-3 idempotent seed (DATA-01, DATA-02). Synthetic data only; standard objects/fields only.
// Run as MF-ADMIN through the driver (it also uploads the two image Files, then reruns this):
//   python3 testing/provisioning/fixtures.py seed --target-org <alias>
// or alone: sf apex run --file testing/provisioning/apex/seed.apex --target-org <alias>
//
// Logical identity keys (filterable standard fields; never record IDs):
//   MF-ACCOUNT-001  Account.Name
//   MF-ASSET-001/2  Asset.SerialNumber
//   MF-CASE-001/2   Case.Subject + Case.AccountId
//   MF-IMAGE-001 / MF-FILE-DENIED  ContentVersion.Title (IsLatest, owned by the running admin)
//   MF-TECH/SUPPORT/RESTRICTED      User.FederationIdentifier (set by personas.py)
// Every fixture is looked up by its key first; nothing is created when it already exists.
// Grants (manual shares, RowCause Manual) are reconciled to exactly:
//   MF-CASE-001    TECH Edit, SUPPORT Edit         MF-ACCOUNT-001  TECH Read, SUPPORT Read (no case/opportunity access)
//   MF-ASSET-001   TECH Edit                       MF-CASE-002 / MF-ASSET-002  none (owner MF-ADMIN only)
//   MF-RESTRICTED  nothing anywhere
// Files: ContentDocumentLink ShareType 'V' (viewer), Visibility 'AllUsers'; ContentDistribution
// (public links) on fixture Files are removed. Output: "MF|<key>|<status>" debug lines, no IDs.

final String ACCOUNT_NAME = 'CollabTech PoC Test Customer';
final String CASE1_SUBJECT = 'Pump overheating — remote diagnosis';
final String CASE2_SUBJECT = 'MF-CASE-002 restricted negative control (synthetic)';
final String NOTE = 'Synthetic SMF PoC fixture (SMF-3). No customer or personal data.';
Id adminId = UserInfo.getUserId();
Integer issues = 0;

Database.DMLOptions opts = new Database.DMLOptions();
opts.DuplicateRuleHeader.allowSave = true;
opts.AssignmentRuleHeader.useDefaultRule = false;

// ---- personas (created by personas.py; looked up, never created here)
Map<String, Id> persona = new Map<String, Id>();
for (User u : [SELECT Id, FederationIdentifier FROM User
               WHERE FederationIdentifier IN ('MF-TECH', 'MF-SUPPORT', 'MF-RESTRICTED') AND IsActive = true]) {
    persona.put(u.FederationIdentifier, u.Id);
}
for (String p : new List<String>{ 'MF-TECH', 'MF-SUPPORT', 'MF-RESTRICTED' }) {
    if (!persona.containsKey(p)) {
        System.debug('MF|' + p + '|PERSONA-MISSING (run personas.py first; grants skipped)');
        issues++;
    }
}

// ---- MF-ACCOUNT-001
List<Account> accs = [SELECT Id, OwnerId FROM Account WHERE Name = :ACCOUNT_NAME];
Account acc;
if (accs.isEmpty()) {
    acc = new Account(Name = ACCOUNT_NAME, Description = NOTE);
    Database.insert(acc, opts);
    System.debug('MF|MF-ACCOUNT-001|created');
} else {
    acc = accs[0];
    System.debug('MF|MF-ACCOUNT-001|existing' + (accs.size() > 1 ? ' DUPLICATES=' + accs.size() : ''));
    if (accs.size() > 1) { issues++; }
}

// ---- MF-ASSET-001 / MF-ASSET-002
Map<String, String> assetNames = new Map<String, String>{
    'MF-ASSET-001' => 'MF-PUMP-001',
    'MF-ASSET-002' => 'MF-ASSET-002 restricted control equipment'
};
Map<String, Asset> assets = new Map<String, Asset>();
for (Asset a : [SELECT Id, SerialNumber FROM Asset WHERE SerialNumber IN :assetNames.keySet()]) {
    if (assets.containsKey(a.SerialNumber)) {
        System.debug('MF|' + a.SerialNumber + '|DUPLICATE');
        issues++;
    } else {
        assets.put(a.SerialNumber, a);
    }
}
for (String serial : new List<String>{ 'MF-ASSET-001', 'MF-ASSET-002' }) {
    if (assets.containsKey(serial)) {
        System.debug('MF|' + serial + '|existing');
    } else {
        Asset a = new Asset(Name = assetNames.get(serial), SerialNumber = serial, AccountId = acc.Id, Description = NOTE);
        Database.insert(a, opts);
        assets.put(serial, a);
        System.debug('MF|' + serial + '|created');
    }
}

// ---- MF-CASE-001 / MF-CASE-002
Map<String, String> caseSubject = new Map<String, String>{ 'MF-CASE-001' => CASE1_SUBJECT, 'MF-CASE-002' => CASE2_SUBJECT };
Map<String, String> caseAsset = new Map<String, String>{ 'MF-CASE-001' => 'MF-ASSET-001', 'MF-CASE-002' => 'MF-ASSET-002' };
Map<String, Case> cases = new Map<String, Case>();
for (String key : new List<String>{ 'MF-CASE-001', 'MF-CASE-002' }) {
    String subj = caseSubject.get(key);
    List<Case> found = [SELECT Id, OwnerId, IsClosed, AssetId FROM Case WHERE Subject = :subj AND AccountId = :acc.Id];
    if (found.isEmpty()) {
        Case c = new Case(Subject = subj, AccountId = acc.Id, AssetId = assets.get(caseAsset.get(key)).Id, Description = NOTE);
        Database.insert(c, opts);
        cases.put(key, [SELECT Id, OwnerId, IsClosed, AssetId FROM Case WHERE Id = :c.Id]);
        System.debug('MF|' + key + '|created');
    } else {
        cases.put(key, found[0]);
        System.debug('MF|' + key + '|existing' + (found.size() > 1 ? ' DUPLICATES=' + found.size() : ''));
        if (found.size() > 1) { issues++; }
    }
    Case c = cases.get(key);
    if (c.OwnerId != adminId) {
        System.debug('MF|' + key + '|OWNER-NOT-MF-ADMIN (expected the running admin)');
        issues++;
    }
    if (c.AssetId != assets.get(caseAsset.get(key)).Id) {
        System.debug('MF|' + key + '|ASSET-LINK-MISMATCH');
        issues++;
    }
}
if (cases.get('MF-CASE-001').IsClosed) {
    System.debug('MF|MF-CASE-001|CLOSED (contract: open case)');
    issues++;
}

// ---- manual shares, reconciled to the baseline above (dynamic so the script compiles whatever the OWD)
Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
// rows: share object, parent field, level field, record, persona, level ('' = no grant)
List<List<Object>> wanted = new List<List<Object>>{
    new List<Object>{ 'CaseShare', 'CaseId', 'CaseAccessLevel', cases.get('MF-CASE-001').Id, 'MF-TECH', 'Edit' },
    new List<Object>{ 'CaseShare', 'CaseId', 'CaseAccessLevel', cases.get('MF-CASE-001').Id, 'MF-SUPPORT', 'Edit' },
    new List<Object>{ 'AccountShare', 'AccountId', 'AccountAccessLevel', acc.Id, 'MF-TECH', 'Read' },
    new List<Object>{ 'AccountShare', 'AccountId', 'AccountAccessLevel', acc.Id, 'MF-SUPPORT', 'Read' },
    new List<Object>{ 'AssetShare', 'AssetId', 'AssetAccessLevel', assets.get('MF-ASSET-001').Id, 'MF-TECH', 'Edit' }
};
Map<String, List<Id>> fixtureRecords = new Map<String, List<Id>>{
    'CaseShare' => new List<Id>{ cases.get('MF-CASE-001').Id, cases.get('MF-CASE-002').Id },
    'AccountShare' => new List<Id>{ acc.Id },
    'AssetShare' => new List<Id>{ assets.get('MF-ASSET-001').Id, assets.get('MF-ASSET-002').Id }
};
Map<String, String> parentField = new Map<String, String>{ 'CaseShare' => 'CaseId', 'AccountShare' => 'AccountId', 'AssetShare' => 'AssetId' };
Map<String, String> levelField = new Map<String, String>{ 'CaseShare' => 'CaseAccessLevel', 'AccountShare' => 'AccountAccessLevel', 'AssetShare' => 'AssetAccessLevel' };
Map<Id, String> personaById = new Map<Id, String>();
for (String p : persona.keySet()) { personaById.put(persona.get(p), p); }

for (String shareObj : fixtureRecords.keySet()) {
    if (!gd.containsKey(shareObj)) {
        System.debug('MF|' + shareObj + '|UNAVAILABLE (object sharing model is not Private; deploy testing/provisioning/metadata)');
        issues++;
        continue;
    }
    List<Id> recIds = fixtureRecords.get(shareObj);
    String pf = parentField.get(shareObj);
    String lf = levelField.get(shareObj);
    List<SObject> existing = Database.query('SELECT Id, ' + pf + ', UserOrGroupId, ' + lf + ' FROM ' + shareObj
        + ' WHERE ' + pf + ' IN :recIds AND RowCause = \'Manual\'');
    Map<String, SObject> byKey = new Map<String, SObject>();
    for (SObject s : existing) { byKey.put(String.valueOf(s.get(pf)) + '|' + String.valueOf(s.get('UserOrGroupId')), s); }
    Set<String> keep = new Set<String>();
    List<SObject> toInsert = new List<SObject>();
    List<SObject> toUpdate = new List<SObject>();
    for (List<Object> w : wanted) {
        if ((String) w[0] != shareObj || !persona.containsKey((String) w[4])) { continue; }
        Id rec = (Id) w[3];
        Id uid = persona.get((String) w[4]);
        String k = String.valueOf(rec) + '|' + String.valueOf(uid);
        keep.add(k);
        SObject cur = byKey.get(k);
        if (cur != null) {
            if (cur.get(lf) == w[5]) {
                System.debug('MF|' + shareObj + ':' + w[4] + '|existing ' + w[5]);
            } else {
                cur.put(lf, w[5]);
                toUpdate.add(cur);
                System.debug('MF|' + shareObj + ':' + w[4] + '|set ' + w[5]);
            }
            continue;
        }
        SObject s = gd.get(shareObj).newSObject();   // RowCause defaults to Manual
        s.put(pf, rec);
        s.put('UserOrGroupId', uid);
        s.put(lf, w[5]);
        if (shareObj == 'AccountShare') {
            Map<String, Schema.SObjectField> f = gd.get('AccountShare').getDescribe().fields.getMap();
            for (String extra : new List<String>{ 'CaseAccessLevel', 'OpportunityAccessLevel', 'ContactAccessLevel' }) {
                if (f.containsKey(extra) && f.get(extra).getDescribe().isCreateable()) { s.put(extra, 'None'); }
            }
        }
        toInsert.add(s);
        System.debug('MF|' + shareObj + ':' + w[4] + '|granted ' + w[5]);
    }
    if (!toInsert.isEmpty()) { insert toInsert; }
    if (!toUpdate.isEmpty()) { update toUpdate; }
    List<SObject> stale = new List<SObject>();
    for (String k : byKey.keySet()) {
        if (!keep.contains(k)) { stale.add(byKey.get(k)); }
    }
    if (!stale.isEmpty()) {
        delete stale;
        System.debug('MF|' + shareObj + '|removed ' + stale.size() + ' manual share(s) outside the baseline');
    }
}

// ---- Files: link uploaded fixture Files (fixtures.py uploads them with `sf data create file`)
Map<String, String> fileCase = new Map<String, String>{ 'MF-IMAGE-001' => 'MF-CASE-001', 'MF-FILE-DENIED' => 'MF-CASE-002' };
Set<Id> docIds = new Set<Id>();
for (String title : fileCase.keySet()) {
    List<ContentVersion> cv = [SELECT Id, ContentDocumentId FROM ContentVersion
                               WHERE Title = :title AND IsLatest = true AND OwnerId = :adminId];
    if (cv.isEmpty()) {
        System.debug('MF|' + title + '|FILE-NOT-UPLOADED (fixtures.py uploads it, then reruns this seed)');
        issues++;
        continue;
    }
    if (cv.size() > 1) {
        System.debug('MF|' + title + '|DUPLICATES=' + cv.size());
        issues++;
    }
    Id docId = cv[0].ContentDocumentId;
    docIds.add(docId);
    Id caseId = cases.get(fileCase.get(title)).Id;
    Boolean linked = false;
    List<ContentDocumentLink> unexpected = new List<ContentDocumentLink>();
    for (ContentDocumentLink l : [SELECT Id, LinkedEntityId, ShareType, Visibility FROM ContentDocumentLink
                                  WHERE ContentDocumentId = :docId]) {
        if (l.LinkedEntityId == caseId) {
            linked = true;
            if (l.ShareType != 'V') {
                System.debug('MF|' + title + '|LINK-SHARETYPE=' + l.ShareType + ' (expected V)');
                issues++;
            }
        } else if (l.LinkedEntityId != adminId) {
            unexpected.add(l);
        }
    }
    if (!linked) {
        insert new ContentDocumentLink(ContentDocumentId = docId, LinkedEntityId = caseId, ShareType = 'V', Visibility = 'AllUsers');
        System.debug('MF|' + title + '|linked to ' + fileCase.get(title) + ' (ShareType V)');
    } else {
        System.debug('MF|' + title + '|existing link to ' + fileCase.get(title));
    }
    if (!unexpected.isEmpty()) {
        System.debug('MF|' + title + '|UNEXPECTED-LINKS=' + unexpected.size() + ' (not removed; review manually)');
        issues++;
    }
}
if (!docIds.isEmpty()) {
    List<ContentDistribution> pub = [SELECT Id FROM ContentDistribution WHERE ContentDocumentId IN :docIds];
    if (!pub.isEmpty()) {
        delete pub;
        System.debug('MF|ContentDistribution|removed ' + pub.size() + ' public link(s) on fixture Files');
    } else {
        System.debug('MF|ContentDistribution|none');
    }
}

System.debug('MF|SUMMARY|' + (issues == 0 ? 'ok' : 'issues=' + issues));
