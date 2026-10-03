import { describe, expect, it } from 'vitest';
import { CallSession, INVALID_TOKEN, tamperToken } from '../callSession';
import { classifySdkError, redact } from '../callClient';
import type { TokenResult } from '../callApi';
import { FakeClient, fakeFactory } from './fakeClient';

// Unit tests of the SMF-7 client state machine with a FAKE call client and a FAKE token
// endpoint. They are not evidence of a RealtimeKit call, of the Apex boundary, or of any host.

const REAL = 'eyJhbGciOiJIUzI1NiJ9.eyJtIjoxfQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ'; // synthetic: {"m":1}
const granted = async (): Promise<TokenResult> => ({ ok: true, authToken: REAL, displayName: 'Tech Persona' });
const denied = async (): Promise<TokenResult> => ({ ok: false, status: 403, code: 'NO_CASE_ACCESS', message: 'You do not have access to this case or its call room.' });

function session(requestToken = granted, created: FakeClient[] = []) {
  return new CallSession({ requestToken, createClient: fakeFactory(new Set([REAL]), created) });
}

describe('CallSession', () => {
  it('authorizes, joins, toggles mic/camera, leaves and ends local tracks', async () => {
    const created: FakeClient[] = [];
    const s = session(granted, created);
    await s.authorizeAndJoin('case-permitted');
    expect(s.state.phase).toBe('joined');
    await s.setMic(true);
    await s.setCamera(true);
    expect(s.state.mic && s.state.camera).toBe(true);
    await s.setMic(false);
    expect(s.state.mic).toBe(false);
    await s.leave();
    expect(s.state.phase).toBe('left');
    expect(s.state.lastLeave?.allEnded).toBe(true);
    expect(s.state.lastLeave?.tracks).toEqual(['audio:ended', 'video:ended']);
    expect(created[0].calls).toEqual(['join', 'leave']);
  });

  it('denied authorization never creates a call client (CALL-03)', async () => {
    const created: FakeClient[] = [];
    const s = session(denied, created);
    await s.authorizeAndJoin('case-other');
    expect(s.state.phase).toBe('denied');
    expect(s.state.denial).toMatchObject({ status: 403, code: 'NO_CASE_ACCESS' });
    expect(created).toHaveLength(0);
  });

  it('invalid token is rejected once, with no automatic retry', async () => {
    const created: FakeClient[] = [];
    const s = session(granted, created);
    await s.joinWithInvalidToken('invalid');
    expect(s.state.phase).toBe('failed');
    expect(s.state.failure?.code).toBe('TOKEN_REJECTED');
    expect(created).toHaveLength(0);
    expect(s.state.log.filter(l => l.message.includes('FAILED'))).toHaveLength(1);
  });

  it('tampered token (altered signature) is rejected; valid previous token can rejoin', async () => {
    const s = session();
    await s.authorizeAndJoin('case-permitted');
    await s.leave();
    await s.joinWithInvalidToken('tampered');
    expect(s.state.failure?.code).toBe('TOKEN_REJECTED');
    await s.rejoinWithLastToken();
    expect(s.state.phase).toBe('joined');
  });

  it('previous token that the provider rejects (revoked/expired) is dropped', async () => {
    let valid = true;
    const s = new CallSession({
      requestToken: granted,
      createClient: async t => {
        if (!valid || t !== REAL) throw classifySdkError(Object.assign(new Error('Invalid auth token'), { code: '0004' }));
        return new FakeClient(t);
      },
    });
    await s.authorizeAndJoin('case-permitted');
    await s.leave();
    valid = false; // provider revoked the participant
    await s.rejoinWithLastToken();
    expect(s.state.failure?.code).toBe('TOKEN_REJECTED');
    expect(s.state.hasLastToken).toBe(false);
  });

  it('never puts the token into state or the log', async () => {
    const s = session();
    await s.authorizeAndJoin('case-permitted');
    s.log(`debug authToken=${REAL}`);
    const dump = JSON.stringify(s.state);
    expect(dump).not.toContain(REAL);
    expect(dump).not.toContain('c2lnbmF0dXJl');
  });

  it('tracks remote participants and connection events', async () => {
    const created: FakeClient[] = [];
    const s = session(granted, created);
    await s.authorizeAndJoin('case-permitted');
    const c = created[0];
    c.remoteList = [{ id: 'r1', name: 'Support Persona', audioEnabled: true, videoEnabled: true }];
    c.emit({ type: 'remotes' });
    expect(s.state.remotes).toHaveLength(1);
    c.emit({ type: 'connection', state: { socket: 'reconnecting', reconnectAttempt: 1, send: 'disconnected', recv: 'disconnected' } });
    expect(s.state.connection.socket).toBe('reconnecting');
    c.emit({ type: 'autoplayBlocked' });
    expect(s.state.autoplayBlocked).toBe(true);
    await s.resumeAudio();
    expect(c.calls).toContain('resumeAudio');
  });
});

describe('token helpers', () => {
  it('tamperToken changes only the signature', () => {
    const t = tamperToken(REAL);
    expect(t.split('.').slice(0, 2)).toEqual(REAL.split('.').slice(0, 2));
    expect(t).not.toBe(REAL);
    expect(tamperToken('not-a-jwt')).toBe(INVALID_TOKEN);
  });
  it('redact removes JWTs and bearer values', () => {
    expect(redact(`x ${REAL} y`)).toBe('x <redacted-token> y');
    expect(redact('Authorization: Bearer abc.def')).toContain('<redacted>');
  });
  it('classifySdkError maps 0004 to TOKEN_REJECTED and redacts', () => {
    expect(classifySdkError(Object.assign(new Error('Invalid auth token'), { code: '0004' })).code).toBe('TOKEN_REJECTED');
    expect(classifySdkError(Object.assign(new Error('socket closed'), { code: '0012' })).code).toBe('NETWORK');
    expect(classifySdkError(new Error(`boom ${REAL}`)).message).not.toContain(REAL);
  });
});
