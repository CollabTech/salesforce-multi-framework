import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { readHostContext } from '@/features/launch/hostContext';
import { PumpViewer, type DisposeReport, type LoadResult, type PartInfo, type ViewerEvent } from './engine/PumpViewer';
import { judgeAgainstTargets, TARGETS, type FrameStats } from './engine/metrics';
import { fetchBundledModel, ModelLoadError, type FetchedModel } from './engine/sources';
import { detectWebGL, readDeviceIndicators, type WebGLSupport } from './engine/webgl';
import { fixtureBySha, missingModelUrl, SMALL_MODEL_URL } from './fixtures';
import { StaticFallback } from './StaticFallback';

type Status = 'idle' | 'loading' | 'ready' | 'protocol' | 'error' | 'context-lost' | 'unmounted' | 'no-webgl';

interface LogLine {
  t: number;
  msg: string;
}

type ProtocolResult = FrameStats & { contextLostDuringRun: boolean };

const describe = (e: ViewerEvent): string => {
  switch (e.type) {
    case 'select':
      return `select (${e.via}): ${e.part ? `${e.part.label} [${e.part.partId}]` : 'none'}`;
    case 'resize':
      return `resize ${e.size}`;
    case 'orientation':
      return `orientation ${e.orientation}`;
    default:
      return e.type;
  }
};

/** SMF-13 probe: interactive 3D rendering of MF-MODEL-SMALL (3D-01, 3D-02, 3D-03). */
export default function Probe3DPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PumpViewer | null>(null);
  const t0 = useRef(0);
  const [webgl] = useState<WebGLSupport>(() => detectWebGL());
  const [simulateNoWebGL, setSimulateNoWebGL] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [mountCount, setMountCount] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<Omit<FetchedModel, 'bytes'> | null>(null);
  const [load, setLoad] = useState<LoadResult | null>(null);
  const [selected, setSelected] = useState<PartInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [protocol, setProtocol] = useState<ProtocolResult | null>(null);
  const [disposals, setDisposals] = useState<DisposeReport[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [copied, setCopied] = useState(false);

  const note = useCallback((msg: string) => {
    const now = performance.now();
    if (!t0.current) t0.current = now;
    setLog(l => [...l.slice(-199), { t: Math.round(now - t0.current), msg }]);
  }, []);

  useEffect(() => {
    document.title = '3D equipment probe | Field Support PoC';
  }, []);

  const usable = webgl.available && !simulateNoWebGL;

  const loadModel = useCallback(
    async (url: string, label: string) => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      setStatus('loading');
      setError(null);
      setLoad(null);
      setFetched(null);
      setSelected(null);
      note(`load ${label}: request`);
      try {
        const f = await fetchBundledModel(url);
        const { bytes, ...meta } = f;
        setFetched(meta);
        const result = await viewer.load(bytes, f.requestStart, f.bytesReceivedAt);
        if (viewerRef.current !== viewer) return;
        setLoad(result);
        setStatus('ready');
        note(`load ${label}: interactive at ${result.timings.interactiveMs} ms, ${result.scene.triangles} triangles`);
      } catch (e) {
        if (viewerRef.current !== viewer) return;
        const msg = e instanceof ModelLoadError ? `${e.kind}: ${e.message}` : e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus('error');
        note(`load ${label}: FAILED ${msg}`);
      }
    },
    [note],
  );

  // Mount / unmount the viewer. Each mount creates a new WebGL context; cleanup releases it.
  useEffect(() => {
    if (!mounted || !usable || !hostRef.current) return;
    const viewer = new PumpViewer(hostRef.current, {
      onEvent: e => {
        note(describe(e));
        if (e.type === 'select') setSelected(e.part);
        if (e.type === 'context-lost') setStatus('context-lost');
        if (e.type === 'context-restored') setStatus('ready');
      },
    });
    viewerRef.current = viewer;
    note(`viewer mounted (#${mountCount})`);
    void loadModel(SMALL_MODEL_URL, 'MF-MODEL-SMALL');
    return () => {
      viewerRef.current = null;
      const report = viewer.dispose();
      setDisposals(d => [...d, report]);
      note(
        `viewer disposed: geometries ${report.before.geometries}->${report.afterResourceDispose.geometries}, textures ${report.before.textures}->${report.afterResourceDispose.textures}, programs ${report.before.programs}->${report.afterResourceDispose.programs}, context released ${report.contextReleased}`,
      );
    };
  }, [mounted, usable, mountCount, loadModel, note]);

  const runProtocol = async (): Promise<void> => {
    const viewer = viewerRef.current;
    if (!viewer || status !== 'ready') return;
    setStatus('protocol');
    setProtocol(null);
    note('protocol: start (60 s scripted camera path)');
    try {
      const r = await viewer.runProtocol(ms => setProgress(Math.round(ms / 1000)));
      setProtocol(r);
      note(`protocol: done, median ${r.medianFps} fps, p5 ${r.p5Fps} fps, ${r.longFrames} long frames`);
      setStatus('ready');
    } catch (e) {
      note(`protocol: aborted ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const shownStatus: Status = !usable ? 'no-webgl' : !mounted ? 'unmounted' : status;
  const judgement = load && protocol ? judgeAgainstTargets(load.timings.interactiveMs, protocol) : null;
  const fixture = fixtureBySha(fetched?.sha256 ?? null);

  const evidence = useMemo(
    () =>
      JSON.stringify(
        {
          probe: 'SMF-13 3D',
          cases: ['3D-01', '3D-02', '3D-03'],
          host: readHostContext(),
          device: readDeviceIndicators(),
          webgl,
          simulatedNoWebGL: simulateNoWebGL,
          library: 'three 0.186.1 (GLTFLoader, OrbitControls)',
          model: fetched
            ? { fixture: fixture?.id ?? 'unknown (hash does not match a generated fixture)', sha256: fetched.sha256, status: fetched.status, contentType: fetched.contentType, inspection: fetched.inspection }
            : null,
          load,
          protocol,
          targets: TARGETS,
          judgement,
          disposals,
          status: shownStatus,
          error,
          mounts: mountCount,
          log,
        },
        null,
        2,
      ),
    [webgl, simulateNoWebGL, fetched, fixture, load, protocol, judgement, disposals, shownStatus, error, mountCount, log],
  );

  const copy = (): void => {
    void navigator.clipboard?.writeText(evidence).then(() => setCopied(true));
  };

  const busy = status === 'loading' || status === 'protocol';
  const showFallback = !usable || !mounted || status === 'error' || status === 'context-lost';
  const fallbackReason = simulateNoWebGL
      ? 'WebGL unavailable (simulated)'
      : !webgl.available
        ? `WebGL unavailable on this host (${webgl.reason ?? 'no context'})`
        : !mounted
          ? '3D view unmounted'
          : status === 'context-lost'
            ? 'the graphics context was lost; waiting for it to be restored'
            : `the model could not be loaded (${error ?? 'unknown error'})`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-13 · 3D-01 · 3D-02 · 3D-03</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">3D equipment probe</h1>
      <p className="mt-1 text-sm text-slate-600">
        Synthetic pump MF-PUMP-001 (fixture MF-MODEL-SMALL). Drag to orbit, pinch or scroll to zoom, tap a part to select it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="toolbar" aria-label="3D probe controls">
        <Button className="min-h-11" disabled={!mounted || !usable || busy} onClick={() => void loadModel(SMALL_MODEL_URL, 'MF-MODEL-SMALL')}>
          Load MF-MODEL-SMALL
        </Button>
        <Button className="min-h-11" variant="outline" disabled={!mounted || !usable || busy} onClick={() => void loadModel(missingModelUrl(), 'MF-MODEL-MISSING')}>
          Load missing model
        </Button>
        <Button className="min-h-11" variant="outline" disabled={status !== 'ready'} onClick={() => viewerRef.current?.reset()}>
          Reset view
        </Button>
        <Button className="min-h-11" variant="outline" disabled={status !== 'ready'} onClick={() => void runProtocol()}>
          Run 60 s protocol
        </Button>
        <Button className="min-h-11" variant="outline" disabled={status !== 'ready'} onClick={() => viewerRef.current?.simulateContextLoss()}>
          Lose graphics context
        </Button>
        <Button className="min-h-11" variant="outline" disabled={status !== 'context-lost'} onClick={() => viewerRef.current?.simulateContextRestore()}>
          Restore graphics context
        </Button>
        <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => {
            if (!mounted) setMountCount(c => c + 1);
            setMounted(m => !m);
          }}>
          {mounted ? 'Unmount 3D view' : 'Remount 3D view'}
        </Button>
        <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setSimulateNoWebGL(s => !s)}>
          {simulateNoWebGL ? 'Stop simulating no WebGL' : 'Simulate no WebGL'}
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          {mounted && usable && (
            <div className="relative h-[55vh] min-h-72 w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-100" ref={hostRef} data-testid="viewer-host" data-status={status}>
              {selected && (
                <p className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-amber-500 px-2 py-1 text-sm font-semibold text-white shadow" data-testid="selected-label">
                  {selected.label} · {selected.partId}
                </p>
              )}
              {status === 'protocol' && (
                <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-xs text-white" role="status">
                  Protocol running: {progress} / 60 s (input disabled)
                </p>
              )}
            </div>
          )}
          {showFallback && (
            <div className="mt-2">
              <StaticFallback
                reason={fallbackReason}
                onRetry={!mounted ? () => { setMounted(true); setMountCount(c => c + 1); } : status === 'error' ? () => void loadModel(SMALL_MODEL_URL, 'MF-MODEL-SMALL') : undefined}
                retryLabel={!mounted ? 'Remount 3D view' : 'Retry loading MF-MODEL-SMALL'}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parts</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2" aria-label="Select a part">
                {(load?.parts ?? []).map(p => (
                  <li key={p.partId}>
                    <button
                      type="button"
                      aria-pressed={selected?.partId === p.partId}
                      onClick={() => viewerRef.current?.select(p.name)}
                      className="min-h-11 rounded border border-slate-300 px-3 text-sm aria-pressed:border-amber-500 aria-pressed:bg-amber-100"
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm" data-testid="selected-part" aria-live="polite">
                Selected: {selected ? `${selected.label} (${selected.partId})` : 'none'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm" data-testid="measurements">
              <p>Status: <strong data-testid="status">{shownStatus}</strong></p>
              <p data-testid="webgl">WebGL: {webgl.available ? `${webgl.webgl2 ? 'WebGL2' : 'WebGL1'} · ${webgl.renderer ?? 'renderer hidden'}` : `unavailable (${webgl.reason ?? 'no context'})`}</p>
              {load && (
                <>
                  <p>Usable (interactive) after {load.timings.interactiveMs} ms (first frame {load.timings.firstFrameMs} ms, bytes {load.timings.bytesReceivedMs} ms)</p>
                  <p>Scene: {load.scene.triangles} triangles · {load.scene.meshes} meshes · {load.scene.textures} textures</p>
                  <p>GPU resources: {load.rendererInfo.geometries} geometries · {load.rendererInfo.textures} textures · {load.rendererInfo.programs} programs</p>
                </>
              )}
              {fetched && <p>Model hash matches: {fixture ? fixture.id : 'no generated fixture'}</p>}
              {protocol && (
                <p>
                  60 s protocol: median {protocol.medianFps} fps · p5 {protocol.p5Fps} · p95 {protocol.p95Fps} · {protocol.longFrames} long frames · {protocol.frames} frames
                </p>
              )}
              {judgement && <p data-testid="judgement">{judgement.summary}</p>}
              {disposals.length > 0 && <p>Disposals: {disposals.length} (last: geometries {disposals[disposals.length - 1].afterResourceDispose.geometries}, textures {disposals[disposals.length - 1].afterResourceDispose.textures} after release)</p>}
              {error && <p role="alert" className="text-red-700">{error}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Evidence (sanitized)</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="min-h-11" variant="outline" onClick={copy}>
            {copied ? 'Copied' : 'Copy for evidence'}
          </Button>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="smf13-evidence">
            {evidence}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
