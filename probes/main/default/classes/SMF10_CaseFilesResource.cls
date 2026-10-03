/**
 * SMF-10 Apex REST read-back endpoint (user context) for case-linked Salesforce Files.
 *
 *   GET /services/apexrest/smf10/v1/cases/{caseId}/files    -> JSON list (latest versions)
 *   GET /services/apexrest/smf10/v1/versions/{versionId}/data -> raw file bytes
 *
 * Called from the UI bundle through sdk.fetch (Apex REST is on the data-access allowlist;
 * Enterprise REST /query and /sobjects VersionData downloads are not). Both routes run as
 * the calling user (with sharing + WITH USER_MODE in SMF10_CaseFilesService). Hidden and
 * missing records both return 404 with the same message.
 */
@RestResource(urlMapping='/smf10/v1/*')
global with sharing class SMF10_CaseFilesResource {

    private static final String ERROR_BAD_PATH = 'Unsupported path.';
    private static final String ERROR_INVALID_ID = 'Invalid Salesforce Id format.';
    private static final String JSON_TYPE = 'application/json';

    /** Routes GET requests by path shape. */
    @HttpGet
    global static void doGet() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        List<String> parts = pathParts(req.requestURI);
        try {
            if (parts.size() == 3 && parts[0] == 'cases' && parts[2] == 'files') {
                Id caseId = toId(parts[1]);
                writeJson(res, 200, new FilesResponse(SMF10_CaseFilesService.listCaseFiles(caseId)));
                return;
            }
            if (parts.size() == 3 && parts[0] == 'versions' && parts[2] == 'data') {
                Id versionId = toId(parts[1]);
                ContentVersion version = SMF10_CaseFilesService.getVersionWithData(versionId);
                res.statusCode = 200;
                res.addHeader('Content-Type', SMF10_CaseFilesService.contentTypeFor(version.FileExtension));
                res.addHeader('Cache-Control', 'no-store');
                res.responseBody = version.VersionData;
                return;
            }
            writeError(res, 404, ERROR_BAD_PATH);
        } catch (InvalidIdException e) {
            writeError(res, 400, ERROR_INVALID_ID);
        } catch (SMF10_CaseFilesService.NotFoundException e) {
            writeError(res, 404, SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        } catch (QueryException e) {
            // USER_MODE raises QueryException when object/field access is missing:
            // that is a denial, reported like any other hidden record.
            writeError(res, 404, SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
    }

    /** Thrown for path segments that are not Salesforce Ids. */
    public class InvalidIdException extends Exception {}

    /**
     * Path segments after "/smf10/v1/".
     * @param uri request URI
     * @return segments (empty when the prefix is absent)
     */
    @TestVisible
    private static List<String> pathParts(String uri) {
        String marker = '/smf10/v1/';
        if (String.isBlank(uri) || !uri.contains(marker)) {
            return new List<String>();
        }
        String rest = uri.substringAfter(marker).substringBefore('?');
        List<String> parts = new List<String>();
        for (String part : rest.split('/')) {
            if (String.isNotBlank(part)) {
                parts.add(part);
            }
        }
        return parts;
    }

    @TestVisible
    private static Id toId(String value) {
        if (String.isBlank(value) || !Pattern.matches('[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}', value)) {
            throw new InvalidIdException(ERROR_INVALID_ID);
        }
        try {
            return Id.valueOf(value);
        } catch (StringException e) {
            throw new InvalidIdException(ERROR_INVALID_ID, e);
        }
    }

    private static void writeJson(RestResponse res, Integer status, Object body) {
        res.statusCode = status;
        res.addHeader('Content-Type', JSON_TYPE);
        res.addHeader('Cache-Control', 'no-store');
        res.responseBody = Blob.valueOf(JSON.serialize(body));
    }

    private static void writeError(RestResponse res, Integer status, String message) {
        writeJson(res, status, new ErrorResponse(message));
    }

    /** Successful list response. */
    public class FilesResponse {
        public Boolean success = true;
        public List<SMF10_CaseFilesService.FileInfo> files;
        /** @param files latest versions visible to the caller */
        public FilesResponse(List<SMF10_CaseFilesService.FileInfo> files) {
            this.files = files;
        }
    }

    /** Error envelope; never includes internal details. */
    public class ErrorResponse {
        public Boolean success = false;
        public String message;
        /** @param message sanitized message */
        public ErrorResponse(String message) {
            this.message = message;
        }
    }
}
