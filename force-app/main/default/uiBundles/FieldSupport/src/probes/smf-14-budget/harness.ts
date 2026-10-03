/**
 * BUDGET-01/02 harness: per model, N open/close cycles (fresh fetch + load + 1 s render +
 * dispose each time) followed by the SMF-13 60 s scripted protocol, with resource counts.
 * Same protocol for every model and host, so results are comparable.
 */
import { PumpViewer, type DisposeReport, type LoadResult, type RendererInfoSnapshot } from '../smf-13-3d/engine/PumpViewer';
import { judgeAgainstTargets, type FrameStats, type TargetJudgement } from '../smf-13-3d/engine/metrics';
import type { FetchedModel } from '../smf-13-3d/engine/sources';
import { readDeviceIndicators } from '../smf-13-3d/engine/webgl';
import { fixtureBySha } from '../smf-13-3d/fixtures';

export interface CycleResult {
  cycle: number;
  ok: boolean;
  error: string | null;
  bytes: number | null;
  sha256Fixture: string | null;
  timings: LoadResult['timings'] | null;
  loadedInfo: RendererInfoSnapshot | null;
  dispose: DisposeReport | null;
  contextLosses: number;
  jsHeapUsedMiB: number | null;
}

export interface HarnessResult {
  label: string;
  fixtureId: string | null;
  bytes: number | null;
  scene: LoadResult['scene'] | null;
  externalUrlsRequested: string[];
  cycles: CycleResult[];
  protocol: { ok: boolean; error: string | null; timings: LoadResult['timings'] | null; stats: (FrameStats & { contextLostDuringRun: boolean }) | null; judgement: TargetJudgement | null };
  deviceBefore: ReturnType<typeof readDeviceIndicators>;
  deviceAfter: ReturnType<typeof readDeviceIndicators>;
  startedAt: string;
  durationMs: number;
}

export interface HarnessOptions {
  container: HTMLElement;
  label: string;
  fetchModel: () => Promise<FetchedModel>;
  cycles?: number;
  holdMs?: number;
  protocolMs?: number;
  onLog?: (msg: string) => void;
  onViewer?: (viewer: PumpViewer | null) => void;
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const msg = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export async function runHarness(o: HarnessOptions): Promise<HarnessResult> {
  const cycles = o.cycles ?? 5;
  const log = o.onLog ?? (() => undefined);
  const t0 = performance.now();
  const result: HarnessResult = {
    label: o.label,
    fixtureId: null,
    bytes: null,
    scene: null,
    externalUrlsRequested: [],
    cycles: [],
    protocol: { ok: false, error: null, timings: null, stats: null, judgement: null },
    deviceBefore: readDeviceIndicators(),
    deviceAfter: readDeviceIndicators(),
    startedAt: new Date().toISOString(),
    durationMs: 0,
  };

  const open = async (onLoss: () => void): Promise<{ viewer: PumpViewer; load: LoadResult; fetched: FetchedModel }> => {
    const viewer = new PumpViewer(o.container, { onEvent: e => e.type === 'context-lost' && onLoss() });
    o.onViewer?.(viewer);
    try {
      const fetched = await o.fetchModel();
      const load = await viewer.load(fetched.bytes, fetched.requestStart, fetched.bytesReceivedAt);
      result.fixtureId = fixtureBySha(fetched.sha256)?.id ?? result.fixtureId ?? 'unknown (hash not a generated fixture)';
      result.bytes = fetched.bytes.byteLength;
      result.scene = load.scene;
      result.externalUrlsRequested = [...new Set([...result.externalUrlsRequested, ...load.blockedExternalUrls])];
      return { viewer, load, fetched };
    } catch (e) {
      o.onViewer?.(null);
      viewer.dispose();
      throw e;
    }
  };

  for (let i = 1; i <= cycles; i++) {
    let losses = 0;
    const c: CycleResult = { cycle: i, ok: false, error: null, bytes: null, sha256Fixture: null, timings: null, loadedInfo: null, dispose: null, contextLosses: 0, jsHeapUsedMiB: null };
    try {
      const { viewer, load, fetched } = await open(() => losses++);
      c.bytes = fetched.bytes.byteLength;
      c.sha256Fixture = fixtureBySha(fetched.sha256)?.id ?? null;
      c.timings = load.timings;
      await sleep(o.holdMs ?? 1000);
      c.loadedInfo = viewer.info();
      o.onViewer?.(null);
      c.dispose = viewer.dispose();
      c.ok = true;
      log(`${o.label} cycle ${i}: interactive ${load.timings.interactiveMs} ms; released geometries ${c.dispose.before.geometries}->${c.dispose.afterResourceDispose.geometries}, textures ${c.dispose.before.textures}->${c.dispose.afterResourceDispose.textures}`);
    } catch (e) {
      c.error = msg(e);
      log(`${o.label} cycle ${i}: FAILED ${c.error}`);
    }
    c.contextLosses = losses;
    c.jsHeapUsedMiB = readDeviceIndicators().jsHeapUsedMiB;
    result.cycles.push(c);
    await sleep(250);
  }

  try {
    let losses = 0;
    const { viewer, load } = await open(() => losses++);
    result.protocol.timings = load.timings;
    log(`${o.label} protocol: start`);
    const stats = await viewer.runProtocol(undefined, o.protocolMs);
    result.protocol.stats = stats;
    result.protocol.judgement = judgeAgainstTargets(load.timings.interactiveMs, stats);
    result.protocol.ok = true;
    o.onViewer?.(null);
    viewer.dispose();
    log(`${o.label} protocol: median ${stats.medianFps} fps, p5 ${stats.p5Fps}, long frames ${stats.longFrames}, context losses ${losses}`);
  } catch (e) {
    result.protocol.error = msg(e);
    log(`${o.label} protocol: FAILED ${result.protocol.error}`);
  }
  result.deviceAfter = readDeviceIndicators();
  result.durationMs = Math.round(performance.now() - t0);
  return result;
}
