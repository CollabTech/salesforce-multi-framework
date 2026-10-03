import { describe, expect, it } from 'vitest';
import {
  buildConstraints,
  formatDiagnostics,
  mapMediaError,
  readPolicyReport,
  rmsLevel,
  snapshotTrack,
  stopTracks,
} from '../capture';

// Unit tests of probe logic only — not evidence of capture in any host.

function fakeTrack(kind: 'audio' | 'video', label = `${kind} device`): MediaStreamTrack {
  const t = {
    kind,
    label,
    readyState: 'live' as MediaStreamTrackState,
    enabled: true,
    muted: false,
    stop() {
      t.readyState = 'ended';
    },
    getSettings: () => (kind === 'video' ? { width: 640, height: 480, frameRate: 30, deviceId: 'secret-id' } : { sampleRate: 48000, deviceId: 'secret-id' }),
  };
  return t as unknown as MediaStreamTrack;
}

describe('mapMediaError', () => {
  it.each([
    ['NotAllowedError', 'NotAllowedError'],
    ['NotFoundError', 'NotFoundError'],
    ['NotReadableError', 'NotReadableError'],
    ['OverconstrainedError', 'OverconstrainedError'],
    ['SecurityError', 'SecurityError'],
    ['AbortError', 'AbortError'],
    ['PermissionDeniedError', 'NotAllowedError'],
    ['DevicesNotFoundError', 'NotFoundError'],
    ['TrackStartError', 'NotReadableError'],
    ['SomethingElse', 'Unknown'],
  ])('%s → %s', (name, code) => {
    const f = mapMediaError({ name, message: 'm' });
    expect(f.code).toBe(code);
    expect(f.raw).toBe(`${name}: m`);
    expect(f.explanation.length).toBeGreaterThan(10);
  });

  it('keeps the constraint for OverconstrainedError', () => {
    expect(mapMediaError({ name: 'OverconstrainedError', message: '', constraint: 'deviceId' }).constraint).toBe('deviceId');
  });

  it('handles non-error values', () => {
    expect(mapMediaError('boom').code).toBe('Unknown');
  });
});

describe('buildConstraints', () => {
  it('camera only / mic only / both', () => {
    expect(buildConstraints('camera')).toEqual({ video: true, audio: false });
    expect(buildConstraints('mic')).toEqual({ video: false, audio: true });
    expect(buildConstraints('both')).toEqual({ video: true, audio: true });
  });
  it('pins selected devices exactly', () => {
    expect(buildConstraints('both', { cameraId: 'c', micId: 'm' })).toEqual({
      video: { deviceId: { exact: 'c' } },
      audio: { deviceId: { exact: 'm' } },
    });
  });
});

describe('tracks', () => {
  it('snapshot omits device ids', () => {
    const s = snapshotTrack(fakeTrack('video'));
    expect(s.settings).toBe('width=640, height=480, frameRate=30');
    expect(JSON.stringify(s)).not.toContain('secret-id');
  });
  it('stopTracks ends every track and reports the state', () => {
    const ts = [fakeTrack('video'), fakeTrack('audio')];
    expect(stopTracks(ts)).toEqual(['video:ended', 'audio:ended']);
    expect(ts.every(t => t.readyState === 'ended')).toBe(true);
  });
});

describe('rmsLevel', () => {
  it('silence is 0, full swing is ~1', () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 255));
    expect(rmsLevel(loud)).toBeGreaterThan(0.95);
    expect(rmsLevel([])).toBe(0);
  });
});

describe('readPolicyReport', () => {
  it('reports "not exposed" when no policy API exists (jsdom)', () => {
    const r = readPolicyReport(window);
    expect(r.policyApi).toBe('not exposed');
    expect(r.camera).toBe('not exposed');
    expect(r.framed).toBe(false);
  });
  it('uses document.featurePolicy when present', () => {
    const doc = Object.assign(Object.create(document), {
      featurePolicy: { allowsFeature: (f: string) => f !== 'display-capture' },
    }) as Document;
    const win = { self: 1, top: 2, document: doc, isSecureContext: true, navigator: { mediaDevices: undefined } } as unknown as Window;
    const r = readPolicyReport(win);
    expect(r).toMatchObject({ policyApi: 'featurePolicy', camera: 'allowed', displayCapture: 'blocked', framed: true, mediaDevicesApi: false });
  });
});

describe('formatDiagnostics', () => {
  it('includes the evidence fields', () => {
    const out = formatDiagnostics({
      build: 'abc123',
      userAgent: 'UA',
      policy: readPolicyReport(window),
      permissions: { camera: 'granted', microphone: 'denied' },
      tracks: [snapshotTrack(fakeTrack('audio', 'Mic A'))],
      cameraFrames: 12,
      micPeak: 0.25,
      lastFailure: mapMediaError({ name: 'NotAllowedError', message: 'Permission denied' }),
      lastLeave: { at: 't', reason: 'unmount', tracks: ['audio:ended'], allEnded: true, audioContextClosed: true },
      log: [{ at: 't0', message: 'hello' }],
    });
    expect(out).toContain('build: abc123');
    expect(out).toContain('audio "Mic A" readyState=live');
    expect(out).toContain('last failure: NotAllowedError');
    expect(out).toContain('all ended=true');
    expect(out).toContain('t0 hello');
  });
});
