/**
 * SMF-7 Apex REST endpoint called by the UI bundle through sdk.fetch:
 *   POST /services/apexrest/smf7/v1/call-token   body {"caseId": "<Case Id>"}
 * Returns {success, code, message, authToken?, displayName?}. Only the RealtimeKit participant
 * token is ever returned; responses are marked no-store. Thin controller over
 * SMF7_CallAuthService, which performs the user-mode case check.
 */
@RestResource(urlMapping='/smf7/v1/call-token')
global with sharing class SMF7_CallTokenRestResource {
    /**
     * Issues a participant token for the caller's room on the requested Case.
     * @return ApiResponse with the token or a sanitized error code
     */
    @HttpPost
    global static ApiResponse issue() {
        RestResponse res = RestContext.response;
        res.addHeader('Cache-Control', 'no-store');
        String caseId;
        try {
            String body = RestContext.request.requestBody?.toString();
            if (String.isNotBlank(body)) {
                Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(body);
                Object raw = parsed.get('caseId');
                caseId = raw instanceof String ? (String) raw : null;
            }
        } catch (JSONException e) {
            res.statusCode = 400;
            return new ApiResponse(false, 'INVALID_REQUEST', 'Request body must be JSON {"caseId": "..."}.');
        } catch (TypeException e) {
            res.statusCode = 400;
            return new ApiResponse(false, 'INVALID_REQUEST', 'Request body must be JSON {"caseId": "..."}.');
        }
        SMF7_CallAuthService.Result result = new SMF7_CallAuthService().issueToken(caseId);
        res.statusCode = result.httpStatus;
        ApiResponse out = new ApiResponse(result.code == SMF7_CallAuthService.Code.OK, result.code.name(), result.message);
        out.authToken = result.authToken;
        out.displayName = result.displayName;
        return out;
    }

    /** Response envelope. */
    global class ApiResponse {
        global Boolean success;
        global String code;
        global String message;
        global String authToken;
        global String displayName;

        global ApiResponse(Boolean success, String code, String message) {
            this.success = success;
            this.code = code;
            this.message = message;
        }
    }
}
