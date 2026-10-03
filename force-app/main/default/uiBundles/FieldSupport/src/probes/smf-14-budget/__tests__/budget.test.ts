import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveBudget, failureReasons, FALLBACK_TRIGGER_RULE, isSoftwareRenderer, type RunSummary } from '../budget';
import { connectContentPath } from '../delivery';
import { inspectGlb } from '../../smf-13-3d/engine/glb';
import manifest from '../../smf-13-3d/assets/fixture-manifest.json';

const run = (over: Partial<RunSummary>): RunSummary => ({
  envRow: 'ENV-SFMOBILE-ANDROID',
  device: 'Phone A',
  renderer: 'Adreno (TM) 740',
  fixtureId: 'MF-MODEL-SMALL',
  bytes: 317_796,
  triangles: 8_676,
  textures: 0,
  interactiveMs: [900, 800, 850, 820, 810, 830],
  medianFps: 60,
  p5Fps: 45,
  errors: 0,
  unrecoveredContextLosses: 0,
  ...over,
});

describe('BUDGET-04 derivation', () => {
  it('publishes nothing without hardware-rendered runs on required rows', () => {
    const b = deriveBudget([
      run({ envRow: 'ENV-EMULATION-LOCALHOST', renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }),
      run({ envRow: 'ENV-DESKTOP-EDGE', renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }),
    ]);
    expect(b.status).toBe('insufficient-device-data');
    expect(b.devices).toEqual([]);
    expect(b.excludedRuns).toHaveLength(2);
    expect(b.excludedRuns[1].reason).toContain('software renderer');
  });

  it('names only the largest fixture that passed on that device, never an untested size', () => {
    const b = deriveBudget([
      run({}),
      run({ fixtureId: 'MF-MODEL-REP', bytes: 8_647_528, triangles: 240_692, textures: 4, medianFps: 24 }),
      run({ device: 'Phone B', fixtureId: 'MF-MODEL-REP', bytes: 8_647_528, triangles: 240_692, textures: 4 }),
    ]);
    expect(b.status).toBe('derived');
    const a = b.devices.find(d => d.device === 'Phone A');
    expect(a?.maxPassing?.fixtureId).toBe('MF-MODEL-SMALL');
    expect(a?.failing[0].reasons[0]).toContain('median 24 fps');
    expect(b.devices.find(d => d.device === 'Phone B')?.maxPassing?.fixtureId).toBe('MF-MODEL-REP');
  });

  it('applies the fixed targets to every open', () => {
    expect(failureReasons(run({ interactiveMs: [900, 10_001] }))).toEqual(['1 open(s) slower than 10000 ms']);
    expect(failureReasons(run({ medianFps: null }))).toContain('no 60 s protocol result');
    expect(failureReasons(run({ unrecoveredContextLosses: 1, errors: 2 }))).toHaveLength(2);
  });

  it('recognises software renderers', () => {
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer(null)).toBe(true);
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
  });

  it('keeps the fallback rule tied to the story targets and to denial', () => {
    expect(FALLBACK_TRIGGER_RULE.join(' ')).toContain('10000 ms');
    expect(FALLBACK_TRIGGER_RULE.join(' ')).toContain('30 fps');
    expect(FALLBACK_TRIGGER_RULE.join(' ')).toMatch(/denied.*never fall back to a non-access-checked copy/);
  });
});

describe('delivery', () => {
  it('builds the Connect file-content path only for valid Ids', () => {
    expect(connectContentPath('66.0', 'AAAAAAAAAAAAAAAAAA')).toBe('/services/data/v66.0/connect/files/AAAAAAAAAAAAAAAAAA/content');
    expect(() => connectContentPath('66.0', '../../x')).toThrow();
  });

  it('MF-MODEL-REP is self-contained: textures embedded, no external URI for the loader to fetch', () => {
    const b = readFileSync(resolve(__dirname, '../../../../../../../../../testing/fixtures/models/MF-MODEL-REP.glb'));
    const info = inspectGlb(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(info.ok).toBe(true);
    expect(info.externalUris).toEqual([]);
    expect(info.embeddedImages).toBe(4);
    const rep = manifest.models.find(m => m.id === 'MF-MODEL-REP');
    expect(b.byteLength).toBe(rep?.bytes);
    expect(b.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(rep?.textureCount).toBe(4);
  });
});
