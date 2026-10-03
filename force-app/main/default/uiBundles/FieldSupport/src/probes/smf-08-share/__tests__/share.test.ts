import { describe, expect, it } from 'vitest';
import { describeScreenTrack, detectShareSupport, mapShareError } from '../share';
import { CallSession } from '../../smf-07-call/callSession';
import { FakeClient } from '../../smf-07-call/__tests__/fakeClient';

// Unit tests of SMF-8 logic only (fake client; no browser capture, no call, no host).

function win(over: { secure?: boolean; gdm?: boolean; policy?: (f: string) => boolean; ua?: string }): Window {
  const doc = Object.assign(Object.create(document), over.policy ? { featurePolicy: { allowsFeature: over.policy } } : {}) as Document;
  return {
    self: 1,
    top: 1,
    document: doc,
    isSecureContext: over.secure ?? true,
    navigator: { userAgent: over.ua ?? 'Desktop', mediaDevices: { getUserMedia: () => undefined, ...(over.gdm === false ? {} : { getDisplayMedia: () => undefined }) } },
  } as unknown as Window;
}

describe('detectShareSupport', () => {
  it('api present on desktop', () => expect(detectShareSupport(win({})).verdict).toBe('api-present'));
  it('no getDisplayMedia → unsupported-api (mobile web views)', () =>
    expect(detectShareSupport(win({ gdm: false, ua: 'iPhone Mobile' }))).toMatchObject({ verdict: 'unsupported-api', mobileUserAgent: true }));
  it('policy blocks display-capture', () => expect(detectShareSupport(win({ policy: f => f !== 'display-capture' })).verdict).toBe('blocked-by-policy'));
  it('insecure context', () => expect(detectShareSupport(win({ secure: false })).verdict).toBe('insecure-context'));
});

describe('mapShareError', () => {
  it.each([
    ['NotAllowedError', 'CANCELLED_OR_DENIED'],
    ['NotSupportedError', 'NOT_SUPPORTED'],
    ['InvalidStateError', 'NOT_A_GESTURE'],
    ['AbortError', 'ABORTED'],
    ['NotReadableError', 'CAPTURE_FAILED'],
    ['Weird', 'OTHER'],
  ])('%s → %s', (name, code) => expect(mapShareError({ name, message: 'm' }).code).toBe(code));
});

describe('describeScreenTrack', () => {
  it('describes without identifiers', () => {
    const t = { kind: 'video', readyState: 'live', getSettings: () => ({ displaySurface: 'browser', width: 1280, deviceId: 'x' }) } as unknown as MediaStreamTrack;
    expect(describeScreenTrack(t)).toBe('video live [displaySurface=browser, width=1280]');
    expect(describeScreenTrack(undefined)).toBe('none');
  });
});

describe('CallSession.setScreenShare', () => {
  async function joined(client: FakeClient): Promise<CallSession> {
    const s = new CallSession({ requestToken: async () => ({ ok: true, authToken: 't', displayName: 'x' }), createClient: async () => client });
    await s.authorizeAndJoin('case');
    return s;
  }
  it('cancel keeps the call joined (SHARE-02)', async () => {
    const c = new FakeClient('t');
    c.setScreenShare = async () => {
      throw Object.assign(new Error('Permission denied by user'), { name: 'NotAllowedError' });
    };
    const s = await joined(c);
    const r = await s.setScreenShare(true);
    expect(r).toMatchObject({ ok: false, name: 'NotAllowedError' });
    expect(s.state.phase).toBe('joined');
    expect(s.state.screenSharing).toBe(false);
  });
  it('start, stop and restart update state', async () => {
    const c = new FakeClient('t');
    c.setScreenShare = async (on: boolean) => {
      c.localMedia = { ...c.localMedia, screenShareEnabled: on };
    };
    const s = await joined(c);
    await s.setScreenShare(true);
    expect(s.state.screenSharing).toBe(true);
    await s.setScreenShare(false);
    expect(s.state.screenSharing).toBe(false);
    await s.setScreenShare(true);
    expect(s.state.screenSharing).toBe(true);
  });
  it('client without screen share reports NotSupportedError', async () => {
    const s = await joined(new FakeClient('t'));
    expect(await s.setScreenShare(true)).toMatchObject({ ok: false, name: 'NotSupportedError' });
  });
});
