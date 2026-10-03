/**
 * SMF-12 room-token broker. Salesforce decides who may join a case's markup room:
 * the caller must see the case (USER_MODE) and have edit access (UserRecordAccess). Only
 * then does Apex ask the sync service to mint a short-lived token bound to
 * (user Id, case Id, room, expiry), through the Named Credential SMF12_MarkupSync. The
 * External Credential behind it carries the mint key (= the service's
 * SMF12_ROOM_TOKEN_SECRET) as the X-SMF-Mint-Key header; the owner enters it in Setup —
 * it is never in the repository or readable by this code.
 */
public with sharing class SMF12_RoomTokenService {

    public static final String NAMED_CREDENTIAL = 'SMF12_MarkupSync';
    public static final Integer TTL_SECONDS = 300;

    /** Not visible / not editable: reported identically. */
    public class NotFoundException extends Exception {}

    /** The sync service could not mint a token. */
    public class ServiceException extends Exception {}

    /** Token returned to the client (never logged). */
    public class TokenResponse {
        public String token;
        public String room;
        public Long expiresAt;
        public String wsUrl;
    }

    /**
     * Mints a room token for the case as the calling user.
     * @param caseId Case Id
     * @return token, room, expiry (epoch seconds) and WebSocket base URL
     * @throws NotFoundException when the caller cannot see or edit the case
     * @throws ServiceException when the sync service refuses or is unreachable
     */
    public static TokenResponse mintForCase(Id caseId) {
        if (caseId == null || !SMF10_CaseFilesService.isCaseVisible(caseId) || !canEdit(caseId)) {
            throw new NotFoundException(SMF10_CaseFilesService.NOT_FOUND_MESSAGE);
        }
        HttpRequest request = new HttpRequest();
        request.setEndpoint('callout:' + NAMED_CREDENTIAL + '/mint');
        request.setMethod('POST');
        request.setTimeout(10000);
        request.setHeader('Content-Type', 'application/json');
        request.setBody(JSON.serialize(new Map<String, Object>{
            'userId' => UserInfo.getUserId(),
            'caseId' => String.valueOf(caseId),
            'ttlSeconds' => TTL_SECONDS,
            'displayName' => UserInfo.getName()
        }));
        HttpResponse response;
        try {
            response = new Http().send(request);
        } catch (CalloutException e) {
            throw new ServiceException('Markup sync service unreachable.', e);
        }
        if (response.getStatusCode() != 200) {
            throw new ServiceException('Markup sync service refused the request (' + response.getStatusCode() + ').');
        }
        TokenResponse token = (TokenResponse) JSON.deserialize(response.getBody(), TokenResponse.class);
        if (String.isBlank(token.token) || String.isBlank(token.room)) {
            throw new ServiceException('Markup sync service returned no token.');
        }
        return token;
    }

    private static Boolean canEdit(Id caseId) {
        List<UserRecordAccess> access = [
            SELECT RecordId, HasEditAccess FROM UserRecordAccess
            WHERE UserId = :UserInfo.getUserId() AND RecordId = :caseId
            WITH USER_MODE
        ];
        return !access.isEmpty() && access[0].HasEditAccess;
    }
}
