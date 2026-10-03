import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui';
import { Checkbox } from '@/components/ui/checkbox';
import type { CallExtensionContext } from '../smf-07-call/CallProbe';
import { RemoteVideoProbe } from '../smf-07-call/media';
import { FRAME_H, FRAME_W, drawMarker, markerValue } from '../smf-07-call/marker';
import { describeScreenTrack, detectShareSupport, mapShareError, type ShareFailure } from './share';
import fallbackUrl from './fallback-placeholder.svg';

interface RemoteScreen {
  name: string;
  frames: number;
  marker: number | null;
  distinct: number;
  audio: string;
}

/** Static image (+ marker) as a video track: the approved fallback when screen sharing is unavailable. */
async function createFallbackTrack(): Promise<{ track: MediaStreamTrack; stop: () => void }> {
  const img = new Image();
  img.src = fallbackUrl;
  await img.decode().catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  const start = performance.now();
  const timer = window.setInterval(() => {
    ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
    drawMarker(ctx, markerValue(performance.now(), start), 'IMAGE');
  }, 200);
  const track = canvas.captureStream(5).getVideoTracks()[0];
  return {
    track,
    stop: () => {
      window.clearInterval(timer);
      track.stop();
    },
  };
}

/**
 * SMF-8 panel inside the SMF-7 call: start/stop/restart screen share from a gesture, explicit
 * cancel/denial/unsupported outcomes that keep the call usable, the static-image fallback,
 * screen audio reported only as captured or not (SHARE-03), and decoding of a received screen.
 */
export function SharePanel({ session, state, sendCustomVideo }: CallExtensionContext) {
  const support = useMemo(() => detectShareSupport(), []);
  const [failure, setFailure] = useState<ShareFailure | null>(null);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [fallbackOn, setFallbackOn] = useState(false);
  const fallbackRef = useRef<{ stop: () => void } | null>(null);
  const [localTest, setLocalTest] = useState<{ video: string; audio: string } | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const localStream = useRef<MediaStream | null>(null);
  const localPreview = useRef<HTMLVideoElement>(null);
  const remoteRefs = useRef(new Map<string, HTMLVideoElement>());
  const probes = useRef(new Map<string, RemoteVideoProbe>());
  const [remoteScreens, setRemoteScreens] = useState<Record<string, RemoteScreen>>({});
  const joined = state.phase === 'joined';

  const note = (m: string): void => {
    session.log(m);
    setAttempts(a => [...a, `${new Date().toISOString().slice(11, 19)} ${m}`].slice(-12));
  };

  const share = async (on: boolean): Promise<void> => {
    setFailure(null);
    const r = await session.setScreenShare(on);
    if (!r.ok) {
      const f = mapShareError({ name: r.name, message: r.message });
      setFailure(f);
      note(`screen share ${on ? 'start' : 'stop'} → ${f.code}; call phase still ${session.state.phase}`);
    } else {
      const local = session.localMedia();
      note(`screen share ${on ? 'started' : 'stopped'}: ${describeScreenTrack(local?.screenVideoTrack)}; screen audio ${local?.screenAudioTrack ? 'captured' : 'not captured'}`);
    }
  };

  const toggleFallback = async (): Promise<void> => {
    if (fallbackOn) {
      fallbackRef.current?.stop();
      fallbackRef.current = null;
      await sendCustomVideo(null);
      setFallbackOn(false);
      note('static-image fallback stopped');
      return;
    }
    const fb = await createFallbackTrack();
    fallbackRef.current = fb;
    await sendCustomVideo(fb.track);
    setFallbackOn(true);
    note('static-image fallback sent as video (placeholder image, not MF-IMAGE-001)');
  };

  /** Local test without a call: exercises getDisplayMedia start/stop/cancel directly. */
  const startLocalTest = async (): Promise<void> => {
    setFailure(null);
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      const f = mapShareError({ name: 'NotSupportedError', message: 'getDisplayMedia is not available' });
      setFailure(f);
      note(`local share test → ${f.code}`);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: withAudio });
      localStream.current = s;
      const v = s.getVideoTracks()[0];
      const a = s.getAudioTracks()[0];
      v.addEventListener('ended', () => {
        note('local share ended by the browser/OS control (user stopped sharing)');
        setLocalTest(t => (t ? { ...t, video: describeScreenTrack(v) } : t));
      });
      if (localPreview.current) {
        localPreview.current.srcObject = new MediaStream([v]);
        void localPreview.current.play().catch(() => undefined);
      }
      const rec = { video: describeScreenTrack(v), audio: a ? describeScreenTrack(a) : withAudio ? 'requested, not offered/selected' : 'not requested' };
      setLocalTest(rec);
      note(`local share test started: ${rec.video}; audio ${rec.audio}`);
    } catch (e) {
      const f = mapShareError(e);
      setFailure(f);
      note(`local share test → ${f.code} (${f.raw})`);
    }
  };

  const stopLocalTest = (): void => {
    const tracks = localStream.current?.getTracks() ?? [];
    tracks.forEach(t => t.stop());
    localStream.current = null;
    if (localPreview.current) localPreview.current.srcObject = null;
    note(`local share test stopped: ${tracks.map(t => `${t.kind}:${t.readyState}`).join(', ') || 'no tracks'}`);
    setLocalTest(null);
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const next: Record<string, RemoteScreen> = {};
      for (const p of session.state.remotes) {
        if (!p.screenShareEnabled) continue;
        const el = remoteRefs.current.get(p.id);
        if (el && p.screenVideoTrack && (el.srcObject as MediaStream | null)?.getVideoTracks()[0] !== p.screenVideoTrack) {
          el.srcObject = new MediaStream([p.screenVideoTrack]);
          void el.play().catch(() => undefined);
        }
        if (!probes.current.has(p.id)) probes.current.set(p.id, new RemoteVideoProbe());
        const v = probes.current.get(p.id)!.sample(el ?? null);
        next[p.id] = { name: p.name, frames: v.frames, marker: v.marker, distinct: v.distinctLast10s, audio: p.screenAudioTrack ? p.screenAudioTrack.readyState : 'none' };
      }
      setRemoteScreens(next);
    }, 500);
    return () => {
      window.clearInterval(id);
      localStream.current?.getTracks().forEach(t => t.stop());
      fallbackRef.current?.stop();
    };
  }, [session]);

  const sharers = state.remotes.filter(p => p.screenShareEnabled);

  return (
    <Card className="mt-4" data-testid="share-panel">
      <CardHeader>
        <CardTitle>SMF-8 · Screen share (SHARE-01..03)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm" data-testid="share-support">
          <p>
            Host observation: <strong data-testid="share-verdict">{support.verdict}</strong> · getDisplayMedia={String(support.getDisplayMedia)} · display-capture policy=
            {support.displayCapturePolicy} · framed={String(support.framed)} · mobile UA={String(support.mobileUserAgent)}
          </p>
          <p className="mt-1">{support.explanation}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11" disabled={!joined || state.screenSharing} onClick={() => void share(true)} data-testid="share-start">
            {attempts.some(a => a.includes('stopped')) ? 'Restart screen share' : 'Start screen share'}
          </Button>
          <Button className="min-h-11" variant="outline" disabled={!joined || !state.screenSharing} onClick={() => void share(false)} data-testid="share-stop">
            Stop screen share
          </Button>
          <Button className="min-h-11" variant="outline" disabled={!joined} onClick={() => void toggleFallback()} data-testid="fallback-toggle">
            {fallbackOn ? 'Stop static image' : 'Send static image instead (fallback)'}
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/probes/diagnostic-screen" target="_blank">
              Open diagnostic screen (tab to share)
            </Link>
          </Button>
        </div>
        <p className="text-sm" data-testid="share-state">
          Sharing: <strong>{String(state.screenSharing)}</strong> · call phase {state.phase}
        </p>

        {failure && (
          <Alert variant="destructive" data-testid="share-failure">
            <AlertTitle data-testid="share-failure-code">{failure.code}</AlertTitle>
            <AlertDescription>
              <p>{failure.explanation}</p>
              <p className="mt-1 font-mono text-xs">{failure.raw}</p>
            </AlertDescription>
          </Alert>
        )}

        {(failure || support.verdict !== 'api-present' || fallbackOn) && (
          <figure className="rounded border p-2" data-testid="fallback-image">
            <img src={fallbackUrl} alt="Static image fallback — placeholder, not MF-IMAGE-001" className="w-full max-w-md" />
            <figcaption className="text-xs text-slate-600">Approved fallback slot: placeholder until the SMF-3 MF-IMAGE-001 asset is available.</figcaption>
          </figure>
        )}

        <div data-testid="remote-screens">
          <p className="text-sm font-medium">Received screens ({sharers.length})</p>
          {sharers.map(p => {
            const r = remoteScreens[p.id];
            return (
              <div key={p.id} className="mt-2 rounded border p-2" data-testid="remote-screen">
                <video
                  ref={el => {
                    if (el) remoteRefs.current.set(p.id, el);
                    else remoteRefs.current.delete(p.id);
                  }}
                  className="aspect-video w-full rounded bg-slate-900"
                  autoPlay
                  muted
                  playsInline
                />
                <p className="text-sm" data-testid="remote-screen-stats">
                  From {p.name}: frames {r?.frames ?? 0} · marker {r?.marker ?? '—'} · changes/10 s {r?.distinct ?? 0} · screen audio {r?.audio ?? 'none'}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded border p-3">
          <p className="text-sm font-medium">Local share test (no call needed)</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Label className="flex min-h-11 items-center gap-2">
              <Checkbox checked={withAudio} onCheckedChange={v => setWithAudio(v === true)} data-testid="share-audio-request" />
              Request screen audio (SHARE-03, optional)
            </Label>
            <Button className="min-h-11" variant="outline" onClick={() => void startLocalTest()} data-testid="local-share-start">
              Start local share test
            </Button>
            <Button className="min-h-11" variant="outline" disabled={!localTest} onClick={stopLocalTest} data-testid="local-share-stop">
              Stop local share test
            </Button>
          </div>
          <video ref={localPreview} className="mt-2 aspect-video w-full max-w-md rounded bg-slate-900" autoPlay muted playsInline data-testid="local-share-preview" />
          <p className="mt-1 text-xs" data-testid="local-share-state">
            {localTest ? `video ${localTest.video}; audio ${localTest.audio}` : 'not sharing'}
          </p>
        </div>

        <ul className="text-xs text-slate-600" data-testid="share-attempts">
          {attempts.map(a => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
