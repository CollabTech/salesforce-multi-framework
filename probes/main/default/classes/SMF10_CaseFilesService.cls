/**
 * SMF-10 read-back service for case-linked Salesforce Files.
 *
 * Every query runs WITH USER_MODE in a with-sharing class, so the calling user's own
 * record sharing, object permissions and field-level security decide what is returned.
 * That is what makes the SMF-10 denial cases meaningful: MF-RESTRICTED (no case access)
 * and MF-FILE-DENIED (linked only to MF-CASE-002) must come back as NOT FOUND for the
 * business personas, exactly as they would through any other user-context API.
 *
 * The service never creates ContentDistribution (public link) records. It only counts
 * the distributions the caller can see so the UI can report "no public link".
 */
public with sharing class SMF10_CaseFilesService {

    /** Uniform message: does not reveal whether a record exists but is hidden. */
    public static final String NOT_FOUND_MESSAGE = 'Not found or no access.';
    public static final Integer MAX_FILES = 50;

    /** Thrown when the record does not exist or the caller cannot see it. */
    public class NotFoundException extends Exception {}

    /** Sanitized description of one case-linked File (latest version). */
    public class FileInfo {
        public String contentDocumentId;
        public String latestVersionId;
        public String linkedEntityId;
        public String title;
        public String fileExtension;
        public String fileType;
        public Integer contentSize;
        public String versionNumber;
        public String description;
        public String reasonForChange;
        public String checksum;
        public Datetime createdDate;
        public String shareType;
        public String visibility;
        /** Public links visible to the caller; null when the caller cannot query them. */
        public Integer publicLinkCount;
    }

    /**
     * Lists the latest version of every File linked to the case, as the calling user.
     * @param caseId Case record Id
     * @return files ordered newest first; empty when the case has no visible Files
     * @throws NotFoundException when the case is not visible to the caller
     */
    public static List<FileInfo> listCaseFiles(Id caseId) {
        if (caseId == null) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }
        if (!isCaseVisible(caseId)) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId, LinkedEntityId, ShareType, Visibility
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :caseId
            WITH USER_MODE
            LIMIT :MAX_FILES
        ];
        Map<Id, ContentDocumentLink> linkByDocumentId = new Map<Id, ContentDocumentLink>();
        for (ContentDocumentLink link : links) {
            linkByDocumentId.put(link.ContentDocumentId, link);
        }
        if (linkByDocumentId.isEmpty()) {
            return new List<FileInfo>();
        }
        Set<Id> documentIds = linkByDocumentId.keySet();
        List<ContentVersion> versions = [
            SELECT Id, ContentDocumentId, Title, FileExtension, FileType, ContentSize,
                VersionNumber, Description, ReasonForChange, Checksum, CreatedDate
            FROM ContentVersion
            WHERE ContentDocumentId IN :documentIds AND IsLatest = TRUE
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT :MAX_FILES
        ];
        Map<Id, Integer> publicLinksByDocumentId = countPublicLinks(documentIds);
        List<FileInfo> files = new List<FileInfo>();
        for (ContentVersion version : versions) {
            ContentDocumentLink link = linkByDocumentId.get(version.ContentDocumentId);
            FileInfo info = new FileInfo();
            info.contentDocumentId = version.ContentDocumentId;
            info.latestVersionId = version.Id;
            info.linkedEntityId = link?.LinkedEntityId;
            info.title = version.Title;
            info.fileExtension = version.FileExtension;
            info.fileType = version.FileType;
            info.contentSize = version.ContentSize;
            info.versionNumber = version.VersionNumber;
            info.description = version.Description;
            info.reasonForChange = version.ReasonForChange;
            info.checksum = version.Checksum;
            info.createdDate = version.CreatedDate;
            info.shareType = link?.ShareType;
            info.visibility = link?.Visibility;
            info.publicLinkCount = publicLinksByDocumentId == null
                ? null
                : (publicLinksByDocumentId.get(version.ContentDocumentId) ?? 0);
            files.add(info);
        }
        return files;
    }

    /**
     * Returns one ContentVersion including its VersionData, as the calling user.
     * VersionData counts against the 6 MB synchronous heap limit; the SMF-10 upload
     * policy caps images at 5 MiB.
     * @param versionId ContentVersion Id
     * @return the version with VersionData
     * @throws NotFoundException when the version is not visible to the caller
     */
    public static ContentVersion getVersionWithData(Id versionId) {
        if (versionId == null) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }
        List<ContentVersion> versions = [
            SELECT Id, ContentDocumentId, Title, FileExtension, ContentSize, VersionData
            FROM ContentVersion
            WHERE Id = :versionId
            WITH USER_MODE
            LIMIT 1
        ];
        if (versions.isEmpty()) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }
        return versions[0];
    }

    /**
     * Maps a file extension to a response content type (images and JSON only; anything
     * else is served as an opaque download).
     * @param fileExtension extension without the dot
     * @return MIME type
     */
    public static String contentTypeFor(String fileExtension) {
        String ext = String.isBlank(fileExtension) ? '' : fileExtension.toLowerCase();
        switch on ext {
            when 'png' {
                return 'image/png';
            }
            when 'jpg', 'jpeg' {
                return 'image/jpeg';
            }
            when 'gif' {
                return 'image/gif';
            }
            when 'webp' {
                return 'image/webp';
            }
            when 'json' {
                return 'application/json';
            }
            when else {
                return 'application/octet-stream';
            }
        }
    }

    /**
     * True when the caller can read the case under their own sharing and permissions.
     * @param caseId Case Id
     * @return visibility
     */
    public static Boolean isCaseVisible(Id caseId) {
        return ![SELECT Id FROM Case WHERE Id = :caseId WITH USER_MODE LIMIT 1].isEmpty();
    }

    private static Map<Id, Integer> countPublicLinks(Set<Id> documentIds) {
        Map<Id, Integer> counts = new Map<Id, Integer>();
        try {
            for (AggregateResult row : [
                SELECT ContentDocumentId documentId, COUNT(Id) total
                FROM ContentDistribution
                WHERE ContentDocumentId IN :documentIds
                WITH USER_MODE
                GROUP BY ContentDocumentId
            ]) {
                counts.put((Id) row.get('documentId'), (Integer) row.get('total'));
            }
        } catch (QueryException e) {
            // Caller lacks read access to ContentDistribution: report "unknown" (null),
            // never "zero"; the device script checks public links as MF-ADMIN instead.
            return null;
        }
        return counts;
    }
}
