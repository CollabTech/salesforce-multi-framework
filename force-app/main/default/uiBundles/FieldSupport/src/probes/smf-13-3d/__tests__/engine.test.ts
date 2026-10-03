import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { frameStats, judgeAgainstTargets, loadTimings, percentile, TARGETS } from '../engine/metrics';
import { HOME_POSE, poseAt, poseToOffset, PROTOCOL_DURATION_MS } from '../engine/cameraPath';
import { inspectGlb, sha256Hex } from '../engine/glb';
import { acceptModelBytes, classifyStatus, ModelLoadError } from '../engine/sources';
import manifest from '../assets/fixture-manifest.json';

const asset = (name: string): ArrayBuffer => {
  const b = readFileSync(resolve(__dirname, '../assets', name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe('metrics', () => {
  it('computes percentiles with interpolation', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([10, 0], 50)).toBe(5);
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });

  it('derives fps statistics from frame intervals', () => {
    const intervals = [...Array(90).fill(1000 / 60), ...Array(9).fill(40), 120];
    const s = frameStats(intervals);
    expect(s.frames).toBe(100);
    expect(s.medianFps).toBeCloseTo(60, 0);
    expect(s.p5Fps).toBeLessThan(30);
    expect(s.longFrames).toBe(1);
    expect(s.maxFrameMs).toBe(120);
  });

  it('ignores non-positive or non-finite intervals', () => {
    expect(frameStats([0, -1, Number.NaN, 20]).frames).toBe(1);
  });

  it('judges against the fixed story targets and never adjusts them', () => {
    expect(TARGETS).toEqual({ usableWithinMs: 10000, medianFpsAtLeast: 30 });
    const slow = frameStats(Array(100).fill(50));
    const j = judgeAgainstTargets(12_000, slow);
    expect(j.usableWithinTarget).toBe(false);
    expect(j.medianFpsMeetsTarget).toBe(false);
    expect(j.summary).toContain('NOT met');
    const ok = judgeAgainstTargets(900, frameStats(Array(100).fill(16)));
    expect(ok.usableWithinTarget && ok.medianFpsMeetsTarget).toBe(true);
    expect(judgeAgainstTargets(900, frameStats(Array(100).fill(1000 / 30))).medianFpsMeetsTarget).toBe(true);
  });

  it('expresses load marks relative to the request start', () => {
    expect(loadTimings({ request: 100, bytes: 150, parsed: 200, firstFrame: 216, interactive: 232 })).toEqual({
      requestStartMs: 0, bytesReceivedMs: 50, parsedMs: 100, firstFrameMs: 116, interactiveMs: 132,
    });
  });
});

describe('scripted camera path', () => {
  it('is a pure function of elapsed time (repeatable across runs)', () => {
    for (const t of [0, 5_000, 21_234, 36_000, 52_500]) expect(poseAt(t, 10)).toEqual(poseAt(t, 10));
  });

  it('visits every phase and selects each part once per second at the end', () => {
    expect(poseAt(1_000, 10).phase).toBe('orbit');
    expect(poseAt(27_500, 10).phase).toBe('zoom');
    expect(poseAt(27_500, 10).distanceScale).toBeLessThan(0.6);
    expect(poseAt(42_500, 10).phase).toBe('elevation');
    expect(poseAt(50_000, 10).selectIndex).toBe(0);
    expect(poseAt(59_500, 10).selectIndex).toBe(9);
    expect(poseAt(PROTOCOL_DURATION_MS, 10).phase).toBe('done');
  });

  it('places the camera at the framing distance for the home pose', () => {
    const [x, y, z] = poseToOffset(HOME_POSE, 2);
    expect(Math.hypot(x, y, z)).toBeCloseTo(2, 6);
    expect(y).toBeGreaterThan(0);
  });
});

describe('GLB inspection of the generated fixture', () => {
  it('accepts MF-MODEL-SMALL as self-contained and matches the manifest hash', async () => {
    const buf = asset('MF-MODEL-SMALL.glb');
    const info = inspectGlb(buf);
    expect(info.ok).toBe(true);
    expect(info.version).toBe(2);
    expect(info.externalUris).toEqual([]);
    expect(info.copyright).toContain('CC0-1.0');
    const small = manifest.models.find(m => m.id === 'MF-MODEL-SMALL');
    expect(buf.byteLength).toBe(small?.bytes);
    expect(buf.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(await sha256Hex(buf)).toBe(small?.sha256);
  });

  it('rejects an HTML page served in place of a missing asset', async () => {
    const html = new TextEncoder().encode('<!doctype html><html><head></head><body>app</body></html>').buffer;
    expect(inspectGlb(html).ok).toBe(false);
    await expect(acceptModelBytes(html, { requestStart: 0, bytesReceivedAt: 1, status: 200, contentType: 'text/html' })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('rejects a GLB that references an external URI', async () => {
    const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://cdn.invalid/x.bin', byteLength: 4 }] }) + '  ');
    const pad = (4 - (json.length % 4)) % 4;
    const total = 12 + 8 + json.length + pad;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    dv.setUint32(12, json.length + pad, true);
    dv.setUint32(16, 0x4e4f534a, true);
    out.set(json, 20);
    out.fill(0x20, 20 + json.length);
    const info = inspectGlb(out.buffer);
    expect(info.ok).toBe(true);
    expect(info.externalUris).toEqual(['https://cdn.invalid/x.bin']);
    await expect(acceptModelBytes(out.buffer, { requestStart: 0, bytesReceivedAt: 1, status: 200, contentType: null })).rejects.toBeInstanceOf(ModelLoadError);
  });

  it('classifies HTTP failures', () => {
    expect(classifyStatus(403)).toBe('denied');
    expect(classifyStatus(401)).toBe('denied');
    expect(classifyStatus(404)).toBe('missing');
    expect(classifyStatus(500)).toBe('network');
  });
});
