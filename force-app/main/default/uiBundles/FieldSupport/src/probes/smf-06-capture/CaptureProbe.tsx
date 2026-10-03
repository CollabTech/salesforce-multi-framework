import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import {
  UNAVAILABLE_DEVICE_ID,
  apiMissingFailure,
  buildConstraints,
  formatDiagnostics,
  getLastLeave,
  logEntry,
  mapMediaError,
  readPermissionStates,
  readPolicyReport,
  rmsLevel,
  setLastLeave,
  snapshotTrack,
  stopTracks,
  type CaptureFailure,
  type CaptureMode,
  type LeaveRecord,
  type LogEntry,
  type TrackSnapshot,
} from './capture';

interface DeviceOption {
  id: string;
  label: string;
}

const BUILD = import.meta.env.VITE_BUILD_COMMIT ?? 'local';

/**
 * SMF-6 probe: camera-only, mic-only and combined capture from explicit gestures, with
 * per-track state, preview/input activity, device switching, explicit failure mapping and
 * stop-all on leave/unmount. Synthetic scene only; nothing is recorded or uploaded.
 */
export default function CaptureProbe() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracksRef = useRef<MediaStreamTrack[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stoppingRef = useRef(false);

  const [tracks, setTracks] = useState<TrackSnapshot[]>([]);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState<string>('');
  const [micId, setMicId] = useState<string>('');
  const [failure, setFailure] = useState<CaptureFailure | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [frames, setFrames] = useState(0);
  const [audioCtxState, setAudioCtxState] = useState<string>('none');
  const [permissions, setPermissions] = useState({ camera: 'unknown', microphone: 'unknown' });
  const [previousLeave] = useState<LeaveRecord | null>(() => getLastLeave());
  const [copied, setCopied] = useState(false);
  const policy = useMemo(() => readPolicyReport(), []);

  const addLog = useCallback((m: string) => setLog(l => [...l, logEntry(m)].slice(-60)), []);

  const refreshPermissions = useCallback(() => {
    void readPermissionStates().then(setPermissions);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const opt = (d: MediaDeviceInfo, i: number): DeviceOption => ({ id: d.deviceId, label: d.label || `${d.kind} ${i + 1} (label hidden until permission)` });
    setCameras(list.filter(d => d.kind === 'videoinput' && d.deviceId).map(opt));
    setMics(list.filter(d => d.kind === 'audioinput' && d.deviceId).map(opt));
  }, []);

  const teardownMeter = useCallback((): boolean => {
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
      return true;
    }
    return ctx === null || ctx.state === 'closed';
  }, []);

  /** Stop every track and the meter; record the result for CAP-03. */
  const stopAll = useCallback(
    (reason: LeaveRecord['reason']): LeaveRecord => {
      stoppingRef.current = true;
      const results = stopTracks(tracksRef.current);
      const allEnded = tracksRef.current.every(t => t.readyState === 'ended');
      tracksRef.current = [];
      const closed = teardownMeter();
      if (videoRef.current) videoRef.current.srcObject = null;
      const rec: LeaveRecord = { at: new Date().toISOString(), reason, tracks: results, allEnded, audioContextClosed: closed };
      setLastLeave(rec);
      stoppingRef.current = false;
      return rec;
    },
    [teardownMeter],
  );

  const startMeter = useCallback(
    (track: MediaStreamTrack) => {
      teardownMeter();
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        addLog('mic meter: AudioContext not available in this host');
        return;
      }
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      void ctx.resume().finally(() => setAudioCtxState(ctx.state));
      setAudioCtxState(ctx.state);
    },
    [addLog, teardownMeter],
  );

  const watchTrack = useCallback(
    (t: MediaStreamTrack) => {
      t.addEventListener('ended', () => {
        if (!stoppingRef.current) addLog(`${t.kind} track ended by the runtime/device (not by the probe): "${t.label}"`);
      });
      t.addEventListener('mute', () => addLog(`${t.kind} track muted by the runtime (no media flowing)`));
      t.addEventListener('unmute', () => addLog(`${t.kind} track unmuted`));
    },
    [addLog],
  );

  const attach = useCallback(
    (all: MediaStreamTrack[]) => {
      tracksRef.current = all;
      const video = all.find(t => t.kind === 'video');
      const audio = all.find(t => t.kind === 'audio');
      if (videoRef.current) {
        videoRef.current.srcObject = video ? new MediaStream([video]) : null;
        if (video) void videoRef.current.play().catch(e => addLog(`preview play() rejected: ${String(e)}`));
      }
      setFrames(0);
      setPeak(0);
      if (audio) startMeter(audio);
      else teardownMeter();
    },
    [addLog, startMeter, teardownMeter],
  );

  const capture = useCallback(
    async (mode: CaptureMode) => {
      setFailure(null);
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setFailure(apiMissingFailure());
        addLog(`${mode}: getUserMedia not available`);
        return;
      }
      setBusy(true);
      if (tracksRef.current.length > 0) {
        const r = stopAll('stop-button');
        addLog(`stopped previous capture before new request: ${r.tracks.join(', ')}`);
      }
      const t0 = performance.now();
      try {
        const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(mode, { cameraId: cameraId || undefined, micId: micId || undefined }));
        const all = stream.getTracks();
        all.forEach(watchTrack);
        attach(all);
        addLog(`${mode}: granted in ${Math.round(performance.now() - t0)} ms — ${all.map(t => `${t.kind} "${t.label}"`).join(', ')}`);
        await refreshDevices();
      } catch (e) {
        const f = mapMediaError(e);
        setFailure(f);
        addLog(`${mode}: FAILED after ${Math.round(performance.now() - t0)} ms — ${f.raw}`);
      } finally {
        setBusy(false);
        refreshPermissions();
      }
    },
    [addLog, attach, cameraId, micId, refreshDevices, refreshPermissions, stopAll, watchTrack],
  );

  const simulateUnavailable = useCallback(
    async (kind: 'video' | 'audio') => {
      setFailure(null);
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setFailure(apiMissingFailure());
        return;
      }
      const c: MediaStreamConstraints = { [kind]: { deviceId: { exact: UNAVAILABLE_DEVICE_ID } } };
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        s.getTracks().forEach(t => t.stop());
        addLog(`simulated unavailable ${kind}: UNEXPECTEDLY returned a track (stopped)`);
      } catch (e) {
        const f = mapMediaError(e);
        setFailure(f);
        addLog(`simulated unavailable ${kind}: ${f.raw}`);
      }
    },
    [addLog],
  );

  /** Switch one device while capturing: acquire the new track first, then stop the old one. */
  const switchDevice = useCallback(
    async (kind: 'video' | 'audio', deviceId: string) => {
      if (kind === 'video') setCameraId(deviceId);
      else setMicId(deviceId);
      const old = tracksRef.current.find(t => t.kind === kind);
      if (!old) return;
      setFailure(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ [kind]: { deviceId: { exact: deviceId } } });
        const fresh = s.getTracks()[0];
        watchTrack(fresh);
        stoppingRef.current = true;
        old.stop();
        stoppingRef.current = false;
        attach([...tracksRef.current.filter(t => t !== old), fresh]);
        addLog(`switched ${kind}: "${old.label}" (now ${old.readyState}) → "${fresh.label}"`);
      } catch (e) {
        const f = mapMediaError(e);
        setFailure(f);
        addLog(`switch ${kind} FAILED — ${f.raw}; previous track kept (${old.readyState})`);
      }
    },
    [addLog, attach, watchTrack],
  );

  const onStopClick = (): void => {
    const r = stopAll('stop-button');
    setTracks([]);
    setLevel(0);
    addLog(`stop all: ${r.tracks.join(', ') || 'no tracks'}; all ended=${r.allEnded}`);
  };

  // Poll track state, preview frames and mic level while the probe is mounted.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTracks(tracksRef.current.map(snapshotTrack));
      const v = videoRef.current;
      if (v && v.srcObject && typeof v.getVideoPlaybackQuality === 'function') {
        setFrames(v.getVideoPlaybackQuality().totalVideoFrames);
      }
      const a = analyserRef.current;
      if (a) {
        const buf = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buf);
        const l = rmsLevel(buf);
        setLevel(l);
        setPeak(p => Math.max(p, l));
      }
      if (audioCtxRef.current) setAudioCtxState(audioCtxRef.current.state);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  // Device list changes (plug/unplug) and leave/unmount: stop everything.
  useEffect(() => {
    document.title = 'Capture probe | Field Support PoC';
    const md = navigator.mediaDevices;
    const onChange = (): void => {
      void refreshDevices();
    };
    md?.addEventListener?.('devicechange', onChange);
    const onHide = (): void => {
      stopAll('pagehide');
    };
    window.addEventListener('pagehide', onHide);
    const initial = window.setTimeout(() => {
      void refreshDevices();
      refreshPermissions();
    }, 0);
    return () => {
      window.clearTimeout(initial);
      md?.removeEventListener?.('devicechange', onChange);
      window.removeEventListener('pagehide', onHide);
      stopAll('unmount');
    };
  }, [refreshDevices, refreshPermissions, stopAll]);

  const diagnostics = formatDiagnostics({
    build: BUILD,
    userAgent: navigator.userAgent,
    policy,
    permissions,
    tracks,
    cameraFrames: frames,
    micPeak: peak,
    lastFailure: failure,
    lastLeave: getLastLeave() ?? previousLeave,
    log,
  });

  const copy = (): void => {
    void navigator.clipboard?.writeText(diagnostics).then(() => setCopied(true));
  };

  const hasVideo = tracks.some(t => t.kind === 'video' && t.readyState === 'live');
  const hasAudio = tracks.some(t => t.kind === 'audio' && t.readyState === 'live');

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6" data-testid="smf6-probe">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-6 · CAP-01..03</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Camera and microphone capture</h1>
      <p className="mt-2 text-sm text-slate-600">
        Point the camera at the synthetic MF-ASSET-001 scene (pump MF-PUMP-001 printout). Media stays on this device: nothing is recorded or uploaded.
      </p>

      {previousLeave && (
        <Alert className="mt-4" data-testid="previous-leave">
          <AlertTitle>Last leave/unmount (CAP-03)</AlertTitle>
          <AlertDescription>
            {previousLeave.reason} at {previousLeave.at}: {previousLeave.tracks.join(', ') || 'no tracks were live'} — all ended:{' '}
            <strong>{String(previousLeave.allEnded)}</strong>; audio context closed: {String(previousLeave.audioContextClosed)}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1 · Start capture (each button is a user gesture)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button className="min-h-11" disabled={busy} onClick={() => void capture('camera')} data-testid="start-camera">
            Camera only
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void capture('mic')} data-testid="start-mic">
            Mic only
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void capture('both')} data-testid="start-both">
            Camera + mic
          </Button>
          <Button className="min-h-11" variant="destructive" onClick={onStopClick} data-testid="stop-all">
            Stop all
          </Button>
        </CardContent>
      </Card>

      {failure && (
        <Alert variant="destructive" className="mt-4" data-testid="failure">
          <AlertTitle data-testid="failure-code">{failure.code}</AlertTitle>
          <AlertDescription>
            <p>{failure.explanation}</p>
            <p className="mt-1 font-mono text-xs">{failure.raw}{failure.constraint ? ` (constraint: ${failure.constraint})` : ''}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Camera preview</CardTitle>
          </CardHeader>
          <CardContent>
            <video ref={videoRef} className="aspect-video w-full rounded bg-slate-900" autoPlay muted playsInline data-testid="preview" />
            <p className="mt-2 text-sm" data-testid="frames">
              Frames rendered: <strong>{frames}</strong> {hasVideo ? '(live)' : '(no live camera track)'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Microphone input</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="smf6-meter">Level {hasAudio ? '(live — speak to move the meter)' : '(no live mic track)'}</Label>
            <meter id="smf6-meter" className="mt-2 h-6 w-full" min={0} max={1} low={0.05} high={0.5} value={level} data-testid="mic-meter" />
            <p className="mt-2 text-sm" data-testid="mic-peak">
              Peak since start: <strong>{peak.toFixed(3)}</strong> · audio context: {audioCtxState}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2 · Tracks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="track-table">
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>readyState</TableHead>
                <TableHead>enabled / muted</TableHead>
                <TableHead>Settings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No tracks.</TableCell>
                </TableRow>
              )}
              {tracks.map((t, i) => (
                <TableRow key={`${t.kind}-${i}`} data-testid={`track-${t.kind}`}>
                  <TableCell>{t.kind}</TableCell>
                  <TableCell className="max-w-48 break-words">{t.label}</TableCell>
                  <TableCell data-testid={`ready-${t.kind}`}>{t.readyState}</TableCell>
                  <TableCell>
                    {String(t.enabled)} / {String(t.muted)}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal break-words text-xs">{t.settings}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>3 · Devices, retry and unavailable hardware (CAP-02)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Camera ({cameras.length} exposed)</Label>
              <Select value={cameraId} onValueChange={v => void switchDevice('video', v)}>
                <SelectTrigger className="mt-1 min-h-11 w-full" data-testid="camera-select">
                  <SelectValue placeholder="Default camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Microphone ({mics.length} exposed)</Label>
              <Select value={micId} onValueChange={v => void switchDevice('audio', v)}>
                <SelectTrigger className="mt-1 min-h-11 w-full" data-testid="mic-select">
                  <SelectValue placeholder="Default microphone" />
                </SelectTrigger>
                <SelectContent>
                  {mics.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11" onClick={() => void simulateUnavailable('video')} data-testid="sim-camera">
              Simulate unavailable camera
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => void simulateUnavailable('audio')} data-testid="sim-mic">
              Simulate unavailable mic
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => void refreshDevices()}>
              Refresh device list
            </Button>
          </div>
          <p className="text-xs text-slate-600">
            Retry = press a start button again after changing the permission. Real unavailable hardware: disconnect/disable the device, or start capture in another app first.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>4 · Host policy observations (not proof of capture)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm" data-testid="policy">
            <li>Secure context: {String(policy.secureContext)} · framed: {String(policy.framed)}</li>
            <li>
              APIs present: getUserMedia={String(policy.mediaDevicesApi)}, enumerateDevices={String(policy.enumerateDevicesApi)}, getDisplayMedia=
              {String(policy.displayMediaApi)}
            </li>
            <li>
              Permissions-Policy ({policy.policyApi}): camera={policy.camera}, microphone={policy.microphone}
            </li>
            <li>
              Permission state: camera={permissions.camera}, microphone={permissions.microphone}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>5 · Diagnostics for the evidence record</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="diagnostics">
            {diagnostics}
          </pre>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button className="min-h-11" onClick={copy}>
              {copied ? 'Copied' : 'Copy diagnostics'}
            </Button>
            <Button asChild variant="outline" className="min-h-11" data-testid="leave">
              <Link to="/probes">Leave probe (CAP-03)</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
