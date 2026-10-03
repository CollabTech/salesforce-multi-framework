/**
 * BUDGET-04: derive the maximum TESTED scene budget per device from harness results, and the
 * fallback trigger rule. Never extrapolates: a budget names only a fixture that actually passed
 * on that device, and software-rendered or non-required rows never count.
 */
import { TARGETS } from '../smf-13-3d/engine/metrics';

export const REQUIRED_ROWS = ['ENV-DESKTOP-CHROME', 'ENV-DESKTOP-EDGE', 'ENV-SFMOBILE-IOS', 'ENV-SFMOBILE-ANDROID'] as const;

export interface RunSummary {
  envRow: string;
  device: string;
  renderer: string | null;
  fixtureId: string;
  bytes: number;
  triangles: number;
  textures: number;
  /** interactive time of every open (cycles + protocol open), ms */
  interactiveMs: number[];
  medianFps: number | null;
  p5Fps: number | null;
  errors: number;
  unrecoveredContextLosses: number;
}

export interface DeviceBudget {
  envRow: string;
  device: string;
  maxPassing: { fixtureId: string; bytes: number; triangles: number; textures: number } | null;
  failing: { fixtureId: string; reasons: string[] }[];
}

export interface BudgetProposal {
  status: 'insufficient-device-data' | 'derived';
  devices: DeviceBudget[];
  excludedRuns: { envRow: string; fixtureId: string; reason: string }[];
  note: string;
}

export function isSoftwareRenderer(renderer: string | null): boolean {
  return renderer === null || /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer);
}

export function failureReasons(r: RunSummary): string[] {
  const reasons: string[] = [];
  if (r.interactiveMs.length === 0) reasons.push('no successful open');
  const slow = r.interactiveMs.filter(ms => ms > TARGETS.usableWithinMs);
  if (slow.length) reasons.push(`${slow.length} open(s) slower than ${TARGETS.usableWithinMs} ms`);
  if (r.medianFps === null) reasons.push('no 60 s protocol result');
  else if (r.medianFps < TARGETS.medianFpsAtLeast) reasons.push(`median ${r.medianFps} fps < ${TARGETS.medianFpsAtLeast}`);
  if (r.errors) reasons.push(`${r.errors} error(s)`);
  if (r.unrecoveredContextLosses) reasons.push(`${r.unrecoveredContextLosses} unrecovered context loss(es)`);
  return reasons;
}

export function deriveBudget(runs: RunSummary[]): BudgetProposal {
  const excludedRuns: BudgetProposal['excludedRuns'] = [];
  const counted = runs.filter(r => {
    if (!(REQUIRED_ROWS as readonly string[]).includes(r.envRow)) {
      excludedRuns.push({ envRow: r.envRow, fixtureId: r.fixtureId, reason: 'not a required host row (localhost/cloud/emulation/mobile browser)' });
      return false;
    }
    if (isSoftwareRenderer(r.renderer)) {
      excludedRuns.push({ envRow: r.envRow, fixtureId: r.fixtureId, reason: `software renderer (${r.renderer ?? 'unknown'})` });
      return false;
    }
    return true;
  });
  const byDevice = new Map<string, RunSummary[]>();
  for (const r of counted) {
    const key = `${r.envRow}|${r.device}`;
    byDevice.set(key, [...(byDevice.get(key) ?? []), r]);
  }
  const devices: DeviceBudget[] = [...byDevice.values()].map(list => {
    const failing: DeviceBudget['failing'] = [];
    let maxPassing: DeviceBudget['maxPassing'] = null;
    for (const r of [...list].sort((a, b) => a.bytes - b.bytes)) {
      const reasons = failureReasons(r);
      if (reasons.length) failing.push({ fixtureId: r.fixtureId, reasons });
      else if (!maxPassing || r.bytes > maxPassing.bytes) maxPassing = { fixtureId: r.fixtureId, bytes: r.bytes, triangles: r.triangles, textures: r.textures };
    }
    return { envRow: list[0].envRow, device: list[0].device, maxPassing, failing };
  });
  return {
    status: devices.length ? 'derived' : 'insufficient-device-data',
    devices,
    excludedRuns,
    note: devices.length
      ? 'Budget per device = largest fixture that met every target on that device. It does not extend to untested sizes, devices, OS or app versions.'
      : 'No hardware-rendered run on a required host row exists, so no scene budget can be published.',
  };
}

/** Proposed fallback trigger (BUDGET-04). Thresholds are the story targets or measured limits, never new targets. */
export const FALLBACK_TRIGGER_RULE: string[] = [
  'Show the static equipment image instead of 3D when WebGL is unavailable on the host.',
  'Show the static image (with an explicit "Open 3D anyway" choice) when the model is larger in bytes or triangles than the largest fixture that passed on that device class; if the device class has no passing run, 3D is not offered by default.',
  `Switch to the static image when the model is not interactive within ${TARGETS.usableWithinMs} ms of the request.`,
  `Offer the static image when the median frame rate over the first 5 s of interaction is below ${TARGETS.medianFpsAtLeast} fps.`,
  'Show the static image with a retry when the graphics context is lost and not restored within 3 s (e.g. after backgrounding).',
  'Show the static image without retry when delivery is denied or the asset is missing/invalid (never fall back to a non-access-checked copy).',
];
