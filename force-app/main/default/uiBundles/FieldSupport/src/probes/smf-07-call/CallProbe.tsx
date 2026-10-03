import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { findPermittedCaseId, requestCallToken } from './callApi';
import { CallSession, type SessionState } from './callSession';
import { createRealtimeKitClient } from './rtkClient';
import { TEST_PHRASE } from './marker';
import { LevelMeter, RemoteVideoProbe, createMarkerSource, type MarkerSource } from './media';
import type { RemoteParticipant } from './callClient';

const BUILD = import.meta.env.VITE_BUILD_COMMIT ?? 'local';
const FIVE_MIN_MS = 5 * 60 * 1000;

interface RemoteStats {
  level: number;
  frames: number;
  marker: number | null;
  distinct: number;
}

function RemoteTile({ p, onVideo }: { p: RemoteParticipant; onVideo: (id: string, el: HTMLVideoElement | null) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = p.videoEnabled && p.videoTrack ? new MediaStream([p.videoTrack]) : null;
    if (el.srcObject) void el.play().catch(() => undefined);
    onVideo(p.id, el);
    return () => onVideo(p.id, null);
  }, [p.id, p.videoEnabled, p.videoTrack, onVideo]);
  return (
    <div className="rounded border p-2" data-testid="remote-tile">
      <video ref={ref} className="aspect-video w-full rounded bg-slate-900" autoPlay muted playsInline />
      <p className="mt-1 text-sm font-medium">{p.name}</p>
    </div>
  );
}

/** Context handed to story extensions (SMF-8 screen share, SMF-9 recovery). */
export interface CallExtensionContext {
  session: CallSession;
  state: SessionState;
  role: 'TECH' | 'SUPPORT';
  /** Replace the outgoing camera/marker video with a custom track (null = camera off). */
  sendCustomVideo(track: MediaStreamTrack | null): Promise<void>;
}

export interface CallProbeProps {
  tag?: string;
  heading?: string;
  Extension?: ComponentType<CallExtensionContext>;
}

/**
 * SMF-7 probe: authorized two-person RealtimeKit call bound to MF-CASE-001 (MF-ROOM-001).
 * Shows send/receive state per track, a changing marker carried inside the outgoing video, a
 * fixed test phrase, the 5-minute timer, and explicit denial / invalid-token outcomes.
 */
export default function CallProbe({ tag = 'SMF-7 · CALL-01..03', heading = 'Two-person call (RealtimeKit)', Extension }: CallProbeProps = {}) {
  const session = useMemo(() => new CallSession({ requestToken: requestCallToken, createClient: createRealtimeKitClient }), []);
  const [s, setS] = useState<SessionState>(session.state);
  const [role, setRole] = useState<'TECH' | 'SUPPORT'>('TECH');
  const [permittedCase, setPermittedCase] = useState<string | null>(null);
  const [caseLookup, setCaseLookup] = useState('not looked up');
  const [manualCase, setManualCase] = useState('');
  const [markerOn, setMarkerOn] = useState(true);
  const [localMarker, setLocalMarker] = useState<number | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [remoteStats, setRemoteStats] = useState<Record<string, RemoteStats>>({});
  const [copied, setCopied] = useState(false);
  const markerRef = useRef<MarkerSource | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideos = useRef(new Map<string, HTMLVideoElement>());
  const probes = useRef(new Map<string, RemoteVideoProbe>());
  const meters = useRef(new Map<string, LevelMeter>());
  const micMeter = useRef(new LevelMeter());
  const fiveMinLogged = useRef(false);

  useEffect(() => session.subscribe(setS), [session]);

  const onVideo = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) remoteVideos.current.set(id, el);
    else remoteVideos.current.delete(id);
  }, []);

  const stopMarker = useCallback((): string[] => {
    const r = markerRef.current?.stop() ?? [];
    markerRef.current = null;
    setLocalMarker(null);
    return r;
  }, []);

  const lookupCase = async (): Promise<void> => {
    setCaseLookup('looking up…');
    try {
      const id = await findPermittedCaseId();
      setPermittedCase(id);
      setCaseLookup(id ? 'MF-CASE-001 visible to you (id hidden)' : 'MF-CASE-001 is not visible to you');
    } catch (e) {
      setCaseLookup(`lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const leave = useCallback(async () => {
    const markerTracks = stopMarker();
    await session.leave();
    if (markerTracks.length) session.log(`marker source stopped: ${markerTracks.join(', ')}`);
    meters.current.forEach(m => m.close());
    micMeter.current.close();
    fiveMinLogged.current = false;
  }, [session, stopMarker]);

  const sendCustomVideo = useCallback(
    async (track: MediaStreamTrack | null): Promise<void> => {
      const r = stopMarker();
      if (r.length) session.log(`marker source stopped: ${r.join(', ')}`);
      await session.setCamera(track !== null, track ?? undefined);
    },
    [session, stopMarker],
  );

  const setCamera = async (on: boolean): Promise<void> => {
    if (!on) {
      await session.setCamera(false);
      const r = stopMarker();
      if (r.length) session.log(`marker source stopped: ${r.join(', ')}`);
      return;
    }
    if (markerOn) {
      try {
        markerRef.current = await createMarkerSource(role, true);
      } catch (e) {
        session.log(`camera unavailable for the marker composite (${e instanceof Error ? e.name : 'error'}); using the synthetic scene`);
        markerRef.current = await createMarkerSource(role, false);
      }
      await session.setCamera(true, markerRef.current.track);
    } else {
      await session.setCamera(true);
    }
  };

  // Media sampling: timers, marker, levels, remote decoding.
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = session.state;
      if (st.phase === 'joined' && st.joinedAt) {
        const ms = Date.now() - st.joinedAt;
        setElapsed(ms);
        if (ms >= FIVE_MIN_MS && !fiveMinLogged.current) {
          fiveMinLogged.current = true;
          session.log(`5-minute mark: still joined, remote participants=${st.remotes.length}`);
        }
      }
      setLocalMarker(markerRef.current ? markerRef.current.value() : null);
      const lm = session.localMedia();
      setMicLevel(micMeter.current.read(lm?.audioEnabled ? lm.audioTrack : undefined));
      const v = localVideo.current;
      const sending = markerRef.current?.track;
      if (v && (v.srcObject as MediaStream | null)?.getVideoTracks()[0] !== sending) {
        v.srcObject = sending ? new MediaStream([sending]) : null;
        if (sending) void v.play().catch(() => undefined);
      }
      const next: Record<string, RemoteStats> = {};
      for (const p of st.remotes) {
        if (!probes.current.has(p.id)) probes.current.set(p.id, new RemoteVideoProbe());
        if (!meters.current.has(p.id)) meters.current.set(p.id, new LevelMeter());
        const vs = probes.current.get(p.id)!.sample(remoteVideos.current.get(p.id) ?? null);
        const level = meters.current.get(p.id)!.read(p.audioEnabled ? p.audioTrack : undefined);
        next[p.id] = { level, frames: vs.frames, marker: vs.marker, distinct: vs.distinctLast10s };
      }
      setRemoteStats(next);
    }, 500);
    return () => window.clearInterval(id);
  }, [session]);

  useEffect(() => {
    document.title = 'Call probe | Field Support PoC';
    const onHide = (): void => {
      void leave();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void leave();
    };
  }, [leave]);

  const joined = s.phase === 'joined';
  const busy = s.phase === 'authorizing' || s.phase === 'connecting' || s.phase === 'leaving';
  const mmss = `${Math.floor(elapsed / 60000)}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}`;

  const diagnostics = [
    'SMF-7 call diagnostics',
    `build: ${BUILD}`,
    `captured: ${new Date().toISOString()}`,
    `role label: ${role}; case lookup: ${caseLookup}`,
    `phase: ${s.phase}; joined for ${mmss}; remote participants: ${s.remotes.length}`,
    `connection: socket=${s.connection.socket} attempt=${s.connection.reconnectAttempt} send=${s.connection.send} recv=${s.connection.recv}`,
    `send: mic=${s.mic} camera=${s.camera} marker=${localMarker ?? 'off'}`,
    ...s.remotes.map(p => {
      const r = remoteStats[p.id];
      return `receive from "${p.name}": audio=${p.audioEnabled} level=${r ? r.level.toFixed(3) : 'n/a'} video=${p.videoEnabled} frames=${r?.frames ?? 0} marker=${r?.marker ?? 'none'} distinct10s=${r?.distinct ?? 0}`;
    }),
    `denial: ${s.denial ? `${s.denial.status} ${s.denial.code}` : 'none'}; failure: ${s.failure ? s.failure.code : 'none'}`,
    `last leave: ${s.lastLeave ? `${s.lastLeave.at} ${s.lastLeave.tracks.join(', ') || 'no tracks'} all ended=${s.lastLeave.allEnded}` : 'none'}`,
    `user agent: ${navigator.userAgent}`,
    'event log:',
    ...s.log.map(l => `  ${l.at} ${l.message}`),
  ].join('\n');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6" data-testid="smf7-probe">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">{tag}</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{heading}</h1>
      <p className="mt-2 text-sm text-slate-600">
        MF-ROOM-001 is the call room of MF-CASE-001. The org checks your access to the case before issuing a participant authorization. Nothing is recorded.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1 · Case and room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-11" variant="outline" onClick={() => void lookupCase()} data-testid="find-case">
              Find MF-CASE-001
            </Button>
            <span className="text-sm" data-testid="case-lookup">
              {caseLookup}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="smf7-role">Marker label</Label>
            <Button id="smf7-role" variant={role === 'TECH' ? 'default' : 'outline'} className="min-h-11" onClick={() => setRole('TECH')}>
              TECH
            </Button>
            <Button variant={role === 'SUPPORT' ? 'default' : 'outline'} className="min-h-11" onClick={() => setRole('SUPPORT')}>
              SUPPORT
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="smf7-manual-case">Negative control: another Case Id (e.g. MF-CASE-002 → MF-ROOM-002)</Label>
              <Input id="smf7-manual-case" className="mt-1 min-h-11" value={manualCase} onChange={e => setManualCase(e.target.value.trim())} data-testid="manual-case" />
            </div>
            <Button className="min-h-11 self-end" variant="outline" disabled={busy || !manualCase} onClick={() => void session.authorizeAndJoin(manualCase)} data-testid="join-manual">
              Request room for that case
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2 · Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" disabled={busy || joined || !permittedCase} onClick={() => permittedCase && void session.authorizeAndJoin(permittedCase)} data-testid="join">
              Join MF-ROOM-001
            </Button>
            <Button className="min-h-11" variant="destructive" disabled={!joined} onClick={() => void leave()} data-testid="leave-call">
              Leave
            </Button>
            <Button className="min-h-11" variant="outline" disabled={!joined} onClick={() => void session.setMic(!s.mic)} data-testid="toggle-mic">
              {s.mic ? 'Mute mic' : 'Unmute mic'}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={!joined} onClick={() => void setCamera(!s.camera)} data-testid="toggle-camera">
              {s.camera ? 'Camera off' : 'Camera on'}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={joined} onClick={() => setMarkerOn(m => !m)} data-testid="toggle-marker-mode">
              Marker in video: {markerOn ? 'on' : 'off'}
            </Button>
            {s.autoplayBlocked && (
              <Button className="min-h-11" onClick={() => void session.resumeAudio()} data-testid="resume-audio">
                Enable remote audio
              </Button>
            )}
          </div>
          <p className="text-sm" data-testid="call-status">
            Phase: <strong data-testid="phase">{s.phase}</strong> · joined for <span data-testid="elapsed">{mmss}</span> · socket {s.connection.socket} · send {s.connection.send} · recv{' '}
            {s.connection.recv}
          </p>
          {s.denial && (
            <Alert variant="destructive" data-testid="denial">
              <AlertTitle data-testid="denial-code">{s.denial.code}</AlertTitle>
              <AlertDescription>
                HTTP {s.denial.status}: {s.denial.message}
              </AlertDescription>
            </Alert>
          )}
          {s.failure && (
            <Alert variant="destructive" data-testid="failure">
              <AlertTitle data-testid="failure-code">{s.failure.code}</AlertTitle>
              <AlertDescription>{s.failure.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {Extension && <Extension session={session} state={s} role={role} sendCustomVideo={sendCustomVideo} />}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>3 · CALL-01 script</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Read this aloud; the other participant writes down what they hear:</p>
          <p className="mt-2 rounded bg-amber-50 p-3 text-lg font-semibold" data-testid="test-phrase">
            “{TEST_PHRASE}”
          </p>
          <p className="mt-2 text-sm">
            Your marker (inside your outgoing video): <strong data-testid="local-marker">{localMarker ?? 'off'}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>You (sending)</CardTitle>
          </CardHeader>
          <CardContent>
            <video ref={localVideo} className="aspect-video w-full rounded bg-slate-900" autoPlay muted playsInline data-testid="local-preview" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Remote ({s.remotes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2" data-testid="remotes">
            {s.remotes.length === 0 && <p className="text-sm">No remote participant.</p>}
            {s.remotes.map(p => (
              <RemoteTile key={p.id} p={p} onVideo={onVideo} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>4 · Send / receive per track (CALL-02)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="media-table">
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-testid="send-row">
                <TableCell>Send (you)</TableCell>
                <TableCell data-testid="send-audio">
                  {s.mic ? 'on' : 'muted'} · transport {s.connection.send} · level {micLevel.toFixed(2)}
                </TableCell>
                <TableCell data-testid="send-video">
                  {s.camera ? 'on' : 'off'} · marker {localMarker ?? '—'}
                </TableCell>
              </TableRow>
              {s.remotes.map(p => {
                const r = remoteStats[p.id];
                return (
                  <TableRow key={p.id} data-testid="receive-row">
                    <TableCell>Receive from {p.name}</TableCell>
                    <TableCell data-testid="receive-audio">
                      {p.audioEnabled ? 'on' : 'muted'} · level {r ? r.level.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell data-testid="receive-video">
                      {p.videoEnabled ? 'on' : 'off'} · frames {r?.frames ?? 0} · marker {r?.marker ?? '—'} · changes/10 s {r?.distinct ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>5 · Authorization negative controls (CALL-03)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => void session.joinWithInvalidToken('invalid')} data-testid="join-invalid">
            Join with an invalid token
          </Button>
          <Button className="min-h-11" variant="outline" disabled={busy || !s.hasLastToken} onClick={() => void session.joinWithInvalidToken('tampered')} data-testid="join-tampered">
            Join with a tampered token
          </Button>
          <Button className="min-h-11" variant="outline" disabled={busy || joined || !s.hasLastToken} onClick={() => void session.rejoinWithLastToken()} data-testid="rejoin-last">
            Rejoin with previous token (no new authorization)
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>6 · Diagnostics (tokens are never shown)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="diagnostics">
            {diagnostics}
          </pre>
          <Button className="mt-3 min-h-11" onClick={() => void navigator.clipboard?.writeText(diagnostics).then(() => setCopied(true))}>
            {copied ? 'Copied' : 'Copy diagnostics'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
