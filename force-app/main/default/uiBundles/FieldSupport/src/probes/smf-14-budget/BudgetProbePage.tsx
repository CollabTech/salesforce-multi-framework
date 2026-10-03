import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readHostContext } from '@/features/launch/hostContext';
import { maskId } from '../files/lib';
import { PumpViewer } from '../smf-13-3d/engine/PumpViewer';
import { fetchBundledModel, ModelLoadError } from '../smf-13-3d/engine/sources';
import { detectWebGL, readDeviceIndicators } from '../smf-13-3d/engine/webgl';
import { fixtureBySha, SMALL_MODEL_URL } from '../smf-13-3d/fixtures';
import { StaticFallback } from '../smf-13-3d/StaticFallback';
import { deriveBudget, FALLBACK_TRIGGER_RULE, type RunSummary } from './budget';
import { DELIVERY_PATHS, fetchModelFile, isDenial, listCaseModels, type DeliveryPath, type ModelFileRef } from './delivery';
import { runHarness, type HarnessResult } from './harness';

const ENV_ROWS = ['ENV-DESKTOP-CHROME', 'ENV-DESKTOP-EDGE', 'ENV-SFMOBILE-IOS', 'ENV-SFMOBILE-ANDROID', 'ENV-MOBILE-SAFARI', 'ENV-MOBILE-CHROME', 'ENV-CLOUD-CHROMIUM', 'ENV-EMULATION-LOCALHOST'];

interface LogLine {
  t: number;
  msg: string;
}
interface DeliveryCheck {
  label: string;
  path: string;
  id: string;
  outcome: 'delivered' | 'denied' | 'error';
  detail: string;
  fixtureId: string | null;
  bytes: number | null;
  externalUris: number | null;
}
interface TaggedHarness extends HarnessResult {
  path: DeliveryPath | 'bundled';
  envRow: string;
  device: string;
}

const errText = (e: unknown): string => (e instanceof ModelLoadError ? `${e.kind}${e.status ? ` (HTTP ${e.status})` : ''}: ${e.message}` : e instanceof Error ? e.message : String(e));
const idFor = (m: ModelFileRef, p: DeliveryPath): string => (p === 'smf10-apex' ? m.latestVersionId : m.contentDocumentId);

/** SMF-14 probe: authorized model delivery, budget harness, resilience session (BUDGET-01..04). */
export default function BudgetProbePage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PumpViewer | null>(null);
  const t0 = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const [webgl] = useState(() => detectWebGL());
  const [caseId, setCaseId] = useState(() => new URLSearchParams(window.location.search).get('caseId') ?? '');
  const [path, setPath] = useState<DeliveryPath>('connect-content');
  const [envRow, setEnvRow] = useState('ENV-DESKTOP-EDGE');
  const [device, setDevice] = useState('');
  const [models, setModels] = useState<ModelFileRef[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<DeliveryCheck[]>([]);
  const [harness, setHarness] = useState<TaggedHarness[]>([]);
  const [openModel, setOpenModel] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<'none' | 'ready' | 'context-lost' | 'unrecovered' | 'error'>('none');
  const [denyId, setDenyId] = useState('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [copied, setCopied] = useState(false);

  const note = useCallback((msg: string) => {
    const now = performance.now();
    if (!t0.current) t0.current = now;
    setLog(l => [...l.slice(-299), { t: Math.round(now - t0.current), msg }]);
  }, []);

  useEffect(() => {
    document.title = '3D budget probe | Field Support PoC';
  }, []);

  const closeViewer = useCallback(() => {
    const v = viewerRef.current;
    viewerRef.current = null;
    if (v) {
      const r = v.dispose();
      note(`closed: geometries ${r.before.geometries}->${r.afterResourceDispose.geometries}, textures ${r.before.textures}->${r.afterResourceDispose.textures}, context released ${r.contextReleased}`);
    }
    setOpenModel(null);
    setViewerState('none');
  }, [note]);

  // Foreground recovery and orientation monitoring for BUDGET-02 (events are logged for evidence).
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = performance.now();
        note('app hidden (background)');
        return;
      }
      const away = hiddenAt.current ? Math.round(performance.now() - hiddenAt.current) : null;
      hiddenAt.current = null;
      const v = viewerRef.current;
      note(`app visible again after ${away ?? '?'} ms; 3D context lost: ${v ? v.isContextLost : 'no viewer'}`);
      if (v) {
        window.setTimeout(() => {
          if (viewerRef.current === v && v.isContextLost) {
            setViewerState('unrecovered');
            note('foreground recovery: context still lost 3 s after return -> static fallback');
          } else if (viewerRef.current === v) {
            note('foreground recovery: 3D view live 3 s after return');
          }
        }, 3000);
      }
    };
    const onOrientation = (): void => note(`orientation ${window.screen?.orientation?.type ?? 'change'}`);
    document.addEventListener('visibilitychange', onVisibility);
    window.screen?.orientation?.addEventListener('change', onOrientation);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.screen?.orientation?.removeEventListener('change', onOrientation);
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [note]);

  const list = async (): Promise<void> => {
    setBusy('list');
    setListError(null);
    try {
      const found = await listCaseModels(caseId.trim());
      setModels(found);
      note(`listed ${found.length} model File(s) on the case as the current user: ${found.map(m => `${m.title} ${m.contentSize} B`).join(', ') || 'none'}`);
    } catch (e) {
      setModels([]);
      setListError(errText(e));
      note(`list model Files: refused/failed: ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const fetcherFor = (m: ModelFileRef | 'bundled', p: DeliveryPath) => (m === 'bundled' ? () => fetchBundledModel(SMALL_MODEL_URL) : () => fetchModelFile(p, idFor(m, p)));

  const check = async (label: string, p: DeliveryPath | 'bundled', id: string, run: () => ReturnType<typeof fetchBundledModel>): Promise<void> => {
    setBusy('check');
    try {
      const f = await run();
      const fixtureId = fixtureBySha(f.sha256)?.id ?? null;
      setChecks(c => [...c, { label, path: p, id: maskId(id), outcome: 'delivered', detail: `${f.bytes.byteLength} B, HTTP ${f.status}`, fixtureId, bytes: f.bytes.byteLength, externalUris: f.inspection.externalUris.length }]);
      note(`delivery ${label} via ${p}: DELIVERED ${f.bytes.byteLength} B (${fixtureId ?? 'unknown hash'})`);
    } catch (e) {
      const outcome = isDenial(e) ? 'denied' : 'error';
      setChecks(c => [...c, { label, path: p, id: maskId(id), outcome, detail: errText(e), fixtureId: null, bytes: null, externalUris: null }]);
      note(`delivery ${label} via ${p}: ${outcome.toUpperCase()} ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const openInteractive = async (m: ModelFileRef | 'bundled'): Promise<void> => {
    closeViewer();
    if (!hostRef.current) return;
    const label = m === 'bundled' ? 'MF-MODEL-SMALL (bundled)' : m.title;
    const v = new PumpViewer(hostRef.current, {
      onEvent: e => {
        if (e.type === 'context-lost') setViewerState('context-lost');
        if (e.type === 'context-restored') setViewerState('ready');
        if (e.type !== 'select') note(`viewer: ${e.type}${'size' in e ? ` ${e.size}` : ''}`);
      },
    });
    viewerRef.current = v;
    setOpenModel(label);
    setBusy('open');
    try {
      const f = await fetcherFor(m, path)();
      const r = await v.load(f.bytes, f.requestStart, f.bytesReceivedAt);
      setViewerState('ready');
      note(`open ${label}: interactive ${r.timings.interactiveMs} ms, ${r.scene.triangles} triangles, ${r.scene.textures} textures (${r.scene.textureResolutions.join(', ') || 'none'})`);
    } catch (e) {
      setViewerState('error');
      note(`open ${label}: FAILED ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const harnessFor = async (m: ModelFileRef | 'bundled', p: DeliveryPath): Promise<void> => {
    closeViewer();
    if (!hostRef.current) return;
    const label = m === 'bundled' ? 'MF-MODEL-SMALL (bundled asset)' : m.title;
    setBusy('harness');
    note(`harness ${label}: 5 open/close cycles + 60 s protocol via ${m === 'bundled' ? 'bundled asset' : p}`);
    try {
      const r = await runHarness({
        container: hostRef.current,
        label,
        fetchModel: fetcherFor(m, p),
        onLog: note,
        onViewer: v => {
          viewerRef.current = v;
        },
      });
      setHarness(h => [...h, { ...r, path: m === 'bundled' ? 'bundled' : p, envRow, device: device || 'unrecorded' }]);
    } finally {
      viewerRef.current = null;
      setBusy(null);
    }
  };

  const runAll = async (): Promise<void> => {
    for (const m of models) await harnessFor(m, path);
  };

  const summaries: RunSummary[] = harness.map(h => ({
    envRow: h.envRow,
    device: h.device,
    renderer: webgl.renderer,
    fixtureId: h.fixtureId ?? 'unknown',
    bytes: h.bytes ?? 0,
    triangles: h.scene?.triangles ?? 0,
    textures: h.scene?.textures ?? 0,
    interactiveMs: [...h.cycles.flatMap(c => (c.ok && c.timings ? [c.timings.interactiveMs] : [])), ...(h.protocol.timings ? [h.protocol.timings.interactiveMs] : [])],
    medianFps: h.protocol.stats?.medianFps ?? null,
    p5Fps: h.protocol.stats?.p5Fps ?? null,
    errors: h.cycles.filter(c => !c.ok).length + (h.protocol.ok ? 0 : 1),
    unrecoveredContextLosses: h.cycles.reduce((s, c) => s + c.contextLosses, 0) + (h.protocol.stats?.contextLostDuringRun ? 1 : 0),
  }));
  const budget = deriveBudget(summaries);

  const evidence = useMemo(
    () =>
      JSON.stringify(
        {
          probe: 'SMF-14 budget',
          cases: ['BUDGET-01', 'BUDGET-02', 'BUDGET-03', 'BUDGET-04'],
          declaredEnvRow: envRow,
          declaredDevice: device || 'unrecorded',
          host: readHostContext(),
          device: readDeviceIndicators(),
          webgl,
          case: caseId ? maskId(caseId) : null,
          listedModels: models.map(m => ({ title: m.title, bytes: m.contentSize, document: maskId(m.contentDocumentId), version: maskId(m.latestVersionId) })),
          listError,
          deliveryChecks: checks,
          harness,
          budget,
          fallbackTriggerRule: FALLBACK_TRIGGER_RULE,
          log,
        },
        null,
        2,
      ),
    [envRow, device, webgl, caseId, models, listError, checks, harness, budget, log],
  );

  const copy = (): void => {
    void navigator.clipboard?.writeText(evidence).then(() => setCopied(true));
  };

  const pathInfo = DELIVERY_PATHS.find(p => p.id === path);
  const disabled = busy !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-14 · BUDGET-01..04</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">3D delivery and budget probe</h1>
      <p className="mt-1 text-sm text-slate-600">Models are Salesforce Files on the case, fetched as the signed-in user. Record your environment row and device before running.</p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Run setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="env-row">Environment row</Label>
            <select id="env-row" value={envRow} onChange={e => setEnvRow(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2">
              {ENV_ROWS.map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="device">Device / browser (model, OS, app version)</Label>
            <Input id="device" className="mt-1 min-h-11" value={device} onChange={e => setDevice(e.target.value)} placeholder="e.g. Pixel 8, Android 16, Salesforce 256.0" />
          </div>
          <div>
            <Label htmlFor="case-id">Case Id (MF-CASE-001 from the private mapping)</Label>
            <Input id="case-id" className="mt-1 min-h-11" value={caseId} onChange={e => setCaseId(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="path">Delivery path</Label>
            <select id="path" value={path} onChange={e => setPath(e.target.value === 'smf10-apex' ? 'smf10-apex' : 'connect-content')} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2">
              {DELIVERY_PATHS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm sm:col-span-2" data-testid="webgl">
            WebGL: {webgl.available ? `${webgl.webgl2 ? 'WebGL2' : 'WebGL1'} · ${webgl.renderer ?? 'renderer hidden'}` : `unavailable (${webgl.reason ?? ''})`}
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button className="min-h-11" disabled={disabled || !caseId.trim()} onClick={() => void list()}>
              List model Files on the case
            </Button>
            <Button className="min-h-11" variant="outline" disabled={disabled || models.length === 0} onClick={() => void runAll()}>
              Run harness for all listed models
            </Button>
          </div>
          {listError && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2" data-testid="list-error">
              Listing refused or failed: {listError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Models</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" data-testid="model-list">
            {models.map(m => (
              <li key={m.contentDocumentId} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-slate-500">{m.contentSize} B · {maskId(m.contentDocumentId)}</span>
                <Button className="min-h-11" variant="outline" disabled={disabled} onClick={() => void check(m.title, path, idFor(m, path), fetcherFor(m, path))}>
                  Check delivery
                </Button>
                <Button className="min-h-11" variant="outline" disabled={disabled} onClick={() => void openInteractive(m)}>
                  Open
                </Button>
                <Button className="min-h-11" variant="outline" disabled={disabled} onClick={() => void harnessFor(m, path)}>
                  Run harness
                </Button>
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-2 rounded border border-dashed border-amber-400 p-2">
              <span className="font-medium">MF-MODEL-SMALL bundled app asset</span>
              <span className="text-xs text-amber-800">not checked against case/Files sharing</span>
              <Button className="min-h-11" variant="outline" disabled={disabled} onClick={() => void check('MF-MODEL-SMALL (bundled asset)', 'bundled', 'bundled', fetcherFor('bundled', path))}>
                Check delivery
              </Button>
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="deny-id">Id expected to be denied ({pathInfo?.needs === 'version' ? 'ContentVersion' : 'ContentDocument'})</Label>
              <Input id="deny-id" className="mt-1 min-h-11" value={denyId} onChange={e => setDenyId(e.target.value)} autoComplete="off" />
            </div>
            <Button className="min-h-11" variant="outline" disabled={disabled || !denyId.trim()} onClick={() => void check('denial control', path, denyId.trim(), () => fetchModelFile(path, denyId.trim()))}>
              Try fetch (expect denial)
            </Button>
          </div>
          {checks.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm" data-testid="delivery-checks">
              {checks.map((c, i) => (
                <li key={i}>
                  {c.label} via {c.path} [{c.id}]: <strong>{c.outcome}</strong> — {c.detail}
                  {c.fixtureId ? ` (${c.fixtureId})` : ''}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <div className="relative h-[50vh] min-h-72 w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-100" ref={hostRef} data-testid="viewer-host" data-state={viewerState}>
          {busy && (
            <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-xs text-white" role="status" data-testid="busy">
              Working: {busy}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <p className="text-sm" data-testid="viewer-state">
            3D view: {openModel ?? 'closed'} · {viewerState}
          </p>
          <Button className="min-h-11" variant="outline" disabled={!openModel || disabled} onClick={closeViewer}>
            Close 3D view
          </Button>
        </div>
        {(viewerState === 'unrecovered' || viewerState === 'error' || !webgl.available) && (
          <div className="mt-2">
            <StaticFallback reason={!webgl.available ? 'WebGL unavailable on this host' : viewerState === 'error' ? 'the model could not be delivered or loaded' : 'the graphics context did not recover after returning to the app'} onRetry={closeViewer} retryLabel="Close and reopen" />
          </div>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Budget (BUDGET-04)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm" data-testid="budget">
          <p>
            <strong>{budget.status}</strong>: {budget.note}
          </p>
          {budget.devices.map(d => (
            <p key={`${d.envRow}${d.device}`}>
              {d.envRow} · {d.device}: max tested passing {d.maxPassing ? `${d.maxPassing.fixtureId} (${d.maxPassing.bytes} B, ${d.maxPassing.triangles} triangles, ${d.maxPassing.textures} textures)` : 'none'}
              {d.failing.length > 0 && `; failing: ${d.failing.map(f => `${f.fixtureId} (${f.reasons.join('; ')})`).join(', ')}`}
            </p>
          ))}
          <p className="font-medium">Proposed fallback trigger</p>
          <ol className="list-decimal pl-5">
            {FALLBACK_TRIGGER_RULE.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Evidence (sanitized; Ids masked)</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="min-h-11" variant="outline" onClick={copy}>
            {copied ? 'Copied' : 'Copy for evidence'}
          </Button>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="smf14-evidence">
            {evidence}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
