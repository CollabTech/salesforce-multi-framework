/**
 * SMF-11 Apex REST endpoint for markup revisions (user context).
 *
 *   GET  /services/apexrest/smf11/v1/cases/{caseId}/markup -> {success, revision|null}
 *   POST /services/apexrest/smf11/v1/cases/{caseId}/markup -> 201 revision | 200 (idempotent
 *        retry) | 409 {current} conflict | 404 not found / no access | 400 bad request
 *   POST body: {baseSnapshotVersionId, saveKey, imageVersionId, snapshotBodyId, exportBodyId}
 *
 * File bytes travel through the official upload() API; this endpoint only commits the
 * revision under a Case row lock. The bytes are then read back through SMF-10's endpoint.
 */
@RestResource(urlMapping='/smf11/v1/*')
global with sharing class SMF11_MarkupResource {

    private static final String JSON_TYPE = 'application/json';

    /** Latest revision for a case. */
    @HttpGet
    global static void doGet() {
        RestResponse res = RestContext.response;
        try {
            Id caseId = caseIdFrom(RestContext.request.requestURI);
            Response body = new Response(true, null);
            body.revision = SMF11_MarkupService.latestRevision(caseId);
            write(res, 200, body);
        } catch (SMF11_MarkupService.BadRequestException e) {
            write(res, 400, new Response(false, e.getMessage()));
        } catch (SMF11_MarkupService.NotFoundException e) {
            write(res, 404, new Response(false, SMF10_CaseFilesService.NOT_FOUND_MESSAGE));
        } catch (QueryException e) {
            write(res, 404, new Response(false, SMF10_CaseFilesService.NOT_FOUND_MESSAGE));
        }
    }

    /** Saves a revision with conflict detection. */
    @HttpPost
    global static void doPost() {
        RestResponse res = RestContext.response;
        try {
            Id caseId = caseIdFrom(RestContext.request.requestURI);
            SaveRequest payload = (SaveRequest) JSON.deserialize(
                RestContext.request.requestBody?.toString() ?? '{}', SaveRequest.class);
            SMF11_MarkupService.Revision revision = SMF11_MarkupService.save(
                caseId,
                toIdOrNull(payload.baseSnapshotVersionId),
                payload.saveKey,
                toIdOrNull(payload.imageVersionId),
                new SMF11_MarkupService.Source(payload.snapshotBodyId, null),
                new SMF11_MarkupService.Source(payload.exportBodyId, null)
            );
            Response body = new Response(true, revision.reused ? 'Already saved (idempotent retry).' : 'Saved.');
            body.revision = revision;
            write(res, revision.reused ? 200 : 201, body);
        } catch (SMF11_MarkupService.ConflictException e) {
            Response body = new Response(false, e.getMessage());
            body.revision = e.current;
            write(res, 409, body);
        } catch (SMF11_MarkupService.BadRequestException e) {
            write(res, 400, new Response(false, e.getMessage()));
        } catch (JSONException e) {
            write(res, 400, new Response(false, 'Malformed JSON.'));
        } catch (SMF11_MarkupService.NotFoundException e) {
            write(res, 404, new Response(false, SMF10_CaseFilesService.NOT_FOUND_MESSAGE));
        } catch (QueryException e) {
            write(res, 404, new Response(false, SMF10_CaseFilesService.NOT_FOUND_MESSAGE));
        } catch (DmlException e) {
            write(res, 422, new Response(false, 'Save failed: ' + e.getDmlMessage(0)));
        }
    }

    @TestVisible
    private static Id caseIdFrom(String uri) {
        String rest = (uri ?? '').substringAfter('/smf11/v1/').substringBefore('?');
        List<String> parts = rest.split('/');
        if (parts.size() != 3 || parts[0] != 'cases' || parts[2] != 'markup') {
            throw new SMF11_MarkupService.BadRequestException('Unsupported path.');
        }
        Id caseId = toIdOrNull(parts[1]);
        if (caseId == null) {
            throw new SMF11_MarkupService.BadRequestException('Invalid Salesforce Id format.');
        }
        return caseId;
    }

    private static Id toIdOrNull(String value) {
        if (String.isBlank(value) || !Pattern.matches('[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}', value)) {
            return null;
        }
        try {
            return Id.valueOf(value);
        } catch (StringException e) {
            return null;
        }
    }

    private static void write(RestResponse res, Integer status, Response body) {
        res.statusCode = status;
        res.addHeader('Content-Type', JSON_TYPE);
        res.addHeader('Cache-Control', 'no-store');
        res.responseBody = Blob.valueOf(JSON.serialize(body));
    }

    /** POST payload. */
    public class SaveRequest {
        public String baseSnapshotVersionId;
        public String saveKey;
        public String imageVersionId;
        public String snapshotBodyId;
        public String exportBodyId;
    }

    /** Response envelope. */
    public class Response {
        public Boolean success;
        public String message;
        public SMF11_MarkupService.Revision revision;
        /** @param success outcome @param message sanitized message */
        public Response(Boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }
}
