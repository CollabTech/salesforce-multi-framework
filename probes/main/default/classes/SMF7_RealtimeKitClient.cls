/**
 * SMF-7: minimal Cloudflare RealtimeKit REST client (meetings, participants, token refresh).
 * Authentication is entirely org-side: the SMF7_Cloudflare Named Credential and its External
 * Credential principal hold the API token, which this class never sees, logs or returns.
 * Account and app identifiers come from SMF7_RealtimeKit_Config__mdt (set at deploy time),
 * never from code. Response bodies are parsed for the fields needed and never echoed.
 */
public with sharing class SMF7_RealtimeKitClient {
    @TestVisible
    private static final String NAMED_CREDENTIAL = 'callout:SMF7_Cloudflare';
    private static final Integer TIMEOUT_MS = 20000;
    private final Config config;

    /** Provider failure carrying only the HTTP status code (no body, no headers). */
    public class ProviderException extends Exception {
        public Integer statusCode;
    }

    /** RealtimeKit configuration (non-secret identifiers). */
    public class Config {
        public String accountId;
        public String appId;
        public String presetName;
    }

    /** Participant identifiers returned by RealtimeKit. */
    public class Participant {
        public String participantId;
        public String token;
    }

    /**
     * @param config non-secret RealtimeKit identifiers
     */
    public SMF7_RealtimeKitClient(Config config) {
        if (config == null || String.isBlank(config.accountId) || String.isBlank(config.appId)) {
            throw new IllegalArgumentException('RealtimeKit configuration is incomplete');
        }
        this.config = config;
    }

    /**
     * Creates a RealtimeKit meeting.
     * @param title neutral meeting title (no record data)
     * @return the meeting id
     */
    public String createMeeting(String title) {
        Map<String, Object> data = send('POST', basePath() + '/meetings', new Map<String, Object>{ 'title' => title });
        return (String) data.get('id');
    }

    /**
     * Adds a participant to a meeting.
     * @param meetingId RealtimeKit meeting id
     * @param customParticipantId opaque, non-personal identifier of the Salesforce user
     * @param displayName name shown to the other participant
     * @return participant id and auth token
     */
    public Participant addParticipant(String meetingId, String customParticipantId, String displayName) {
        Map<String, Object> data = send(
            'POST',
            basePath() + '/meetings/' + EncodingUtil.urlEncode(meetingId, 'UTF-8') + '/participants',
            new Map<String, Object>{
                'custom_participant_id' => customParticipantId,
                'preset_name' => config.presetName,
                'name' => displayName
            }
        );
        Participant p = new Participant();
        p.participantId = (String) data.get('id');
        p.token = (String) data.get('token');
        return p;
    }

    /**
     * Issues a fresh token for an existing participant (keeps one participant per user and case).
     * @param meetingId RealtimeKit meeting id
     * @param participantId RealtimeKit participant id
     * @return the new auth token
     * @throws ProviderException with statusCode 404 when the participant no longer exists
     */
    public String refreshToken(String meetingId, String participantId) {
        Map<String, Object> data = send(
            'POST',
            basePath() + '/meetings/' + EncodingUtil.urlEncode(meetingId, 'UTF-8') + '/participants/' +
            EncodingUtil.urlEncode(participantId, 'UTF-8') + '/token',
            new Map<String, Object>()
        );
        return (String) data.get('token');
    }

    /**
     * Configuration check used by the deploy stage: lists presets (no body returned to the caller).
     * @return true when the configured preset exists in the app
     */
    public Boolean presetExists() {
        HttpResponse res = execute('GET', basePath() + '/presets?per_page=100', null);
        if (res.getStatusCode() < 200 || res.getStatusCode() > 299) {
            throw newProviderException(res.getStatusCode());
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        for (Object item : (List<Object>) body.get('data')) {
            if (config.presetName == (String) ((Map<String, Object>) item).get('name')) {
                return true;
            }
        }
        return false;
    }

    private String basePath() {
        return '/accounts/' + EncodingUtil.urlEncode(config.accountId, 'UTF-8') + '/realtime/kit/' +
            EncodingUtil.urlEncode(config.appId, 'UTF-8');
    }

    private Map<String, Object> send(String method, String path, Map<String, Object> body) {
        HttpResponse res = execute(method, path, body);
        Integer status = res.getStatusCode();
        if (status < 200 || status > 299) {
            throw newProviderException(status);
        }
        Map<String, Object> parsed;
        try {
            parsed = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        } catch (JSONException e) {
            throw newProviderException(status);
        }
        Object data = parsed.get('data');
        if (parsed.get('success') == false || !(data instanceof Map<String, Object>)) {
            throw newProviderException(status);
        }
        return (Map<String, Object>) data;
    }

    private HttpResponse execute(String method, String path, Map<String, Object> body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NAMED_CREDENTIAL + path);
        req.setMethod(method);
        req.setTimeout(TIMEOUT_MS);
        req.setHeader('Accept', 'application/json');
        if (body != null) {
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(body));
        }
        try {
            return new Http().send(req);
        } catch (CalloutException e) {
            throw newProviderException(0);
        }
    }

    private static ProviderException newProviderException(Integer status) {
        ProviderException e = new ProviderException('RealtimeKit request failed (HTTP ' + status + ')');
        e.statusCode = status;
        return e;
    }
}
