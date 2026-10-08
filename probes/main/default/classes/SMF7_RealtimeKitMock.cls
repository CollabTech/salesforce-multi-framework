/**
 * SMF-7 test double for the Cloudflare RealtimeKit REST API. Routes by path suffix, records
 * every request so tests can assert what was (and was not) sent.
 */
@IsTest
public class SMF7_RealtimeKitMock implements HttpCalloutMock {
    public static final String TOKEN_NEW = 'rtk-participant-token-new';
    public static final String TOKEN_REFRESHED = 'rtk-participant-token-refreshed';
    public static final String MEETING_ID = 'meeting-mock-1';
    public static final String PARTICIPANT_ID = 'participant-mock-1';

    public Integer meetingStatus = 201;
    public Integer participantStatus = 201;
    public Integer refreshStatus = 200;
    public Integer presetStatus = 200;
    public Integer deleteStatus = 200;
    public final List<HttpRequest> requests = new List<HttpRequest>();

    public HttpResponse respond(HttpRequest req) {
        requests.add(req);
        String path = req.getEndpoint();
        HttpResponse res = new HttpResponse();
        res.setHeader('Content-Type', 'application/json');
        if (req.getMethod() == 'DELETE') {
            return reply(res, deleteStatus, '{"success":true,"data":{}}');
        }
        if (path.endsWith('/token')) {
            return reply(res, refreshStatus, '{"success":true,"data":{"token":"' + TOKEN_REFRESHED + '"}}');
        }
        if (path.endsWith('/participants')) {
            return reply(res, participantStatus,
                '{"success":true,"data":{"id":"' + PARTICIPANT_ID + '","token":"' + TOKEN_NEW + '","preset_name":"p"}}');
        }
        if (path.endsWith('/meetings')) {
            return reply(res, meetingStatus, '{"success":true,"data":{"id":"' + MEETING_ID + '","title":"t"}}');
        }
        if (path.contains('/presets')) {
            return reply(res, presetStatus, '{"success":true,"data":[{"id":"x","name":"group_call_host"}],"paging":{}}');
        }
        return reply(res, 404, '{"success":false}');
    }

    private static HttpResponse reply(HttpResponse res, Integer status, String okBody) {
        res.setStatusCode(status);
        // Error bodies deliberately contain secret-looking text so tests prove it is never echoed.
        res.setBody(status >= 200 && status < 300 ? okBody : '{"success":false,"errors":[{"message":"echo Bearer SECRET-API-TOKEN"}]}');
        return res;
    }

    /** @return number of DELETE requests (participant revocations) */
    public Integer deletes() {
        Integer n = 0;
        for (HttpRequest r : requests) {
            if (r.getMethod() == 'DELETE') {
                n++;
            }
        }
        return n;
    }

    /** @return number of requests whose endpoint ends with the suffix */
    public Integer count(String suffix) {
        Integer n = 0;
        for (HttpRequest r : requests) {
            if (r.getEndpoint().endsWith(suffix)) {
                n++;
            }
        }
        return n;
    }
}
