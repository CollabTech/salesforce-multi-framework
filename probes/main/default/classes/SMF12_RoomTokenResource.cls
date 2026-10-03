/**
 * SMF-12 Apex REST endpoint: POST /services/apexrest/smf12/v1/cases/{caseId}/room-token
 * 200 {token, room, expiresAt, wsUrl} | 404 not found or no access | 503 sync service error.
 * The response carries a bearer token: Cache-Control no-store, never logged.
 */
@RestResource(urlMapping='/smf12/v1/*')
global with sharing class SMF12_RoomTokenResource {

    /** Mints a room token for the calling user and case. */
    @HttpPost
    global static void doPost() {
        RestResponse res = RestContext.response;
        res.addHeader('Content-Type', 'application/json');
        res.addHeader('Cache-Control', 'no-store');
        try {
            Id caseId = caseIdFrom(RestContext.request.requestURI);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(SMF12_RoomTokenService.mintForCase(caseId)));
        } catch (SMF12_RoomTokenService.NotFoundException e) {
            res.statusCode = 404;
            res.responseBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{ 'message' => SMF10_CaseFilesService.NOT_FOUND_MESSAGE }));
        } catch (QueryException e) {
            res.statusCode = 404;
            res.responseBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{ 'message' => SMF10_CaseFilesService.NOT_FOUND_MESSAGE }));
        } catch (SMF12_RoomTokenService.ServiceException e) {
            res.statusCode = 503;
            res.responseBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{ 'message' => e.getMessage() }));
        }
    }

    @TestVisible
    private static Id caseIdFrom(String uri) {
        List<String> parts = (uri ?? '').substringAfter('/smf12/v1/').substringBefore('?').split('/');
        if (parts.size() != 3 || parts[0] != 'cases' || parts[2] != 'room-token'
                || !Pattern.matches('[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}', parts[1])) {
            throw new SMF12_RoomTokenService.NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
        try {
            return Id.valueOf(parts[1]);
        } catch (StringException e) {
            throw new SMF12_RoomTokenService.NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
    }
}
