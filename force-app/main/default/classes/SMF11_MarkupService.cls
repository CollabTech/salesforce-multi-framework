/**
 * SMF-11 markup persistence in Salesforce Files with explicit revision association and
 * conflict detection.
 *
 * Mechanism (see docs/poc-briefs/SMF-11.md): every save creates two NEW Files linked to the
 * case through FirstPublishLocationId (Salesforce creates the ContentDocumentLinks):
 *   "MF-MARKUP-001 snapshot r<n>"  editable tldraw document JSON
 *   "MF-MARKUP-001 export r<n>"    annotated PNG
 * Their Descriptions carry the association:
 *   snapshot: smf11;kind=snapshot;rev=<n>;save=<key>;image=<image CV Id>;base=<previous snapshot CV Id|none>
 *   export:   smf11;kind=export;rev=<n>;save=<key>;snapshot=<snapshot CV Id>
 * New Files per save (instead of new versions of one ContentDocument) keep every revision
 * immutable and work whichever persona saved last (a new version of an existing document
 * needs owner/collaborator rights on it).
 *
 * Concurrency: the save locks the Case row (FOR UPDATE), reads the latest revision and
 * refuses with a conflict when the caller's base is not the latest — no silent overwrite.
 * Retries are idempotent by save key. Everything runs as the caller (with sharing,
 * USER_MODE queries, USER_MODE DML).
 */
public with sharing class SMF11_MarkupService {

    public static final String SNAPSHOT_TITLE = 'MF-MARKUP-001 snapshot r';
    public static final String EXPORT_TITLE = 'MF-MARKUP-001 export r';
    public static final String META_PREFIX = 'smf11;';

    /** Thrown when the case or a referenced File is not visible to the caller. */
    public class NotFoundException extends Exception {}

    /** Thrown when the caller's base revision is not the latest. */
    public class ConflictException extends Exception {
        public Revision current;
    }

    /** Thrown for malformed save requests. */
    public class BadRequestException extends Exception {}

    /** File content: an uploaded ContentBody Id (normal path) or inline data (tests). */
    public class Source {
        public String contentBodyId;
        public Blob data;
        public Source(String contentBodyId, Blob data) {
            this.contentBodyId = contentBodyId;
            this.data = data;
        }
    }

    /** One saved markup revision. */
    public class Revision {
        public Integer rev;
        public String saveKey;
        public String snapshotVersionId;
        public String exportVersionId;
        public String imageVersionId;
        public String baseSnapshotVersionId;
        public Datetime createdDate;
        public String createdById;
        public Boolean reused = false;
    }

    /**
     * Latest revision for the case, or null when none exists.
     * @param caseId Case Id
     * @return latest revision
     * @throws NotFoundException when the case is not visible
     */
    public static Revision latestRevision(Id caseId) {
        if (caseId == null || !SMF10_CaseFilesService.isCaseVisible(caseId)) {
            throw new NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
        return findLatest(caseId);
    }

    /**
     * Saves a new revision unless the base is stale (conflict) or the save key was already
     * committed (idempotent retry returns the existing revision).
     */
    public static Revision save(Id caseId, Id baseSnapshotVersionId, String saveKey, Id imageVersionId,
            Source snapshot, Source export) {
        if (caseId == null || String.isBlank(saveKey) || imageVersionId == null || snapshot == null || export == null) {
            throw new BadRequestException('caseId, saveKey, imageVersionId, snapshot and export are required.');
        }
        if (!Pattern.matches('[A-Za-z0-9-]{8,64}', saveKey)) {
            throw new BadRequestException('Invalid save key.');
        }
        List<Case> locked = [SELECT Id FROM Case WHERE Id = :caseId WITH USER_MODE LIMIT 1 FOR UPDATE];
        if (locked.isEmpty()) {
            throw new NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
        assertImageLinkedToCase(caseId, imageVersionId);

        Revision latest = findLatest(caseId);
        if (latest != null && latest.saveKey == saveKey) {
            latest.reused = true;
            return latest;
        }
        String latestId = latest?.snapshotVersionId;
        String baseId = baseSnapshotVersionId == null ? null : String.valueOf(baseSnapshotVersionId);
        if (!sameId(latestId, baseId)) {
            ConflictException conflict = new ConflictException('The markup was saved by another session since you opened it.');
            conflict.current = latest;
            throw conflict;
        }

        Integer rev = latest == null ? 1 : latest.rev + 1;
        ContentVersion snapshotVersion = newVersion(caseId, SNAPSHOT_TITLE + rev, 'json', snapshot);
        snapshotVersion.Description = META_PREFIX + 'kind=snapshot;rev=' + rev + ';save=' + saveKey
            + ';image=' + imageVersionId + ';base=' + (baseId ?? 'none');
        Database.insert(snapshotVersion, AccessLevel.USER_MODE);

        ContentVersion exportVersion = newVersion(caseId, EXPORT_TITLE + rev, 'png', export);
        exportVersion.Description = META_PREFIX + 'kind=export;rev=' + rev + ';save=' + saveKey
            + ';snapshot=' + snapshotVersion.Id;
        Database.insert(exportVersion, AccessLevel.USER_MODE);

        Revision created = new Revision();
        created.rev = rev;
        created.saveKey = saveKey;
        created.snapshotVersionId = snapshotVersion.Id;
        created.exportVersionId = exportVersion.Id;
        created.imageVersionId = imageVersionId;
        created.baseSnapshotVersionId = baseId;
        created.createdDate = Datetime.now();
        created.createdById = UserInfo.getUserId();
        return created;
    }

    /**
     * Parses "smf11;k=v;k=v" metadata.
     * @param description ContentVersion Description
     * @return key/value map (empty when not SMF-11 metadata)
     */
    public static Map<String, String> parseMeta(String description) {
        Map<String, String> meta = new Map<String, String>();
        if (String.isBlank(description) || !description.startsWith(META_PREFIX)) {
            return meta;
        }
        for (String part : description.removeStart(META_PREFIX).split(';')) {
            if (part.contains('=')) {
                meta.put(part.substringBefore('='), part.substringAfter('='));
            }
        }
        return meta;
    }

    private static ContentVersion newVersion(Id caseId, String title, String ext, Source source) {
        ContentVersion version = new ContentVersion(
            Title = title,
            PathOnClient = title.replace(' ', '-') + '.' + ext,
            FirstPublishLocationId = caseId
        );
        if (source.data != null) {
            version.VersionData = source.data;
        } else if (String.isNotBlank(source.contentBodyId)) {
            // Set dynamically: ContentBodyId (from the official upload() API) is the same
            // field UI API createRecord uses in the feature package.
            version.put('ContentBodyId', source.contentBodyId);
        } else {
            throw new BadRequestException('File content is missing.');
        }
        return version;
    }

    private static void assertImageLinkedToCase(Id caseId, Id imageVersionId) {
        List<ContentVersion> image = [
            SELECT ContentDocumentId FROM ContentVersion WHERE Id = :imageVersionId WITH USER_MODE LIMIT 1
        ];
        if (image.isEmpty()) {
            throw new NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
        Id documentId = image[0].ContentDocumentId;
        List<ContentDocumentLink> links = [
            SELECT Id FROM ContentDocumentLink
            WHERE LinkedEntityId = :caseId AND ContentDocumentId = :documentId
            WITH USER_MODE LIMIT 1
        ];
        if (links.isEmpty()) {
            throw new BadRequestException('The image is not linked to this case.');
        }
    }

    private static Revision findLatest(Id caseId) {
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :caseId WITH USER_MODE LIMIT 500
        ];
        Set<Id> documentIds = new Set<Id>();
        for (ContentDocumentLink link : links) {
            documentIds.add(link.ContentDocumentId);
        }
        if (documentIds.isEmpty()) {
            return null;
        }
        String snapshotLike = SNAPSHOT_TITLE + '%';
        String exportLike = EXPORT_TITLE + '%';
        Revision best = null;
        Map<String, Id> exportBySaveKey = new Map<String, Id>();
        for (ContentVersion version : [
            SELECT Id, Title, Description, CreatedDate, CreatedById
            FROM ContentVersion
            WHERE ContentDocumentId IN :documentIds AND IsLatest = TRUE
                AND (Title LIKE :snapshotLike OR Title LIKE :exportLike)
            WITH USER_MODE
            LIMIT 1000
        ]) {
            Map<String, String> meta = parseMeta(version.Description);
            if (meta.get('kind') == 'export') {
                exportBySaveKey.put(meta.get('save'), version.Id);
                continue;
            }
            if (meta.get('kind') != 'snapshot' || !meta.containsKey('rev')) {
                continue;
            }
            Integer rev = Integer.valueOf(meta.get('rev'));
            if (best == null || rev > best.rev) {
                best = new Revision();
                best.rev = rev;
                best.saveKey = meta.get('save');
                best.snapshotVersionId = version.Id;
                best.imageVersionId = meta.get('image');
                best.baseSnapshotVersionId = meta.get('base') == 'none' ? null : meta.get('base');
                best.createdDate = version.CreatedDate;
                best.createdById = version.CreatedById;
            }
        }
        if (best != null) {
            best.exportVersionId = exportBySaveKey.get(best.saveKey);
        }
        return best;
    }

    private static Boolean sameId(String left, String right) {
        if (left == null || right == null) {
            return left == right;
        }
        return left.left(15) == right.left(15);
    }
}
