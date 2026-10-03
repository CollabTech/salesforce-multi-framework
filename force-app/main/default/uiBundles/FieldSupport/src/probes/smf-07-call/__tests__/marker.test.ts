import { describe, expect, it } from 'vitest';
import { FRAME_H, FRAME_W, MARKER_BITS, blockCentre, decodeMarker, fromBits, markerLag, markerValue, toBits } from '../marker';

// Unit tests of marker encode/decode on synthetic pixel buffers (no video, no call).

function paint(value: number, w = FRAME_W, h = FRAME_H): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4).fill(90);
  const set = (x: number, y: number, v: number): void => {
    const sx = Math.round((x * w) / FRAME_W);
    const sy = Math.round((y * h) / FRAME_H);
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dx = -3; dx <= 3; dx += 1) {
        const o = ((Math.min(h - 1, Math.max(0, sy + dy)) * w) + Math.min(w - 1, Math.max(0, sx + dx))) * 4;
        px[o] = px[o + 1] = px[o + 2] = v;
      }
  };
  const [, y] = blockCentre(0);
  const block = blockCentre(1)[0] - blockCentre(0)[0];
  set(blockCentre(0)[0] - block, y, 0); // left guard
  set(blockCentre(MARKER_BITS - 1)[0] + block, y, 255); // right guard
  toBits(value).forEach((b, i) => set(blockCentre(i)[0], y, b ? 255 : 0));
  return px;
}

describe('marker', () => {
  it('bits round-trip', () => {
    for (const v of [0, 1, 2047, 4095, 1234]) expect(fromBits(toBits(v))).toBe(v);
  });
  it('decodes painted frames, including scaled frames', () => {
    expect(decodeMarker(paint(1234))).toBe(1234);
    expect(decodeMarker(paint(77, 320, 180), 320, 180)).toBe(77);
  });
  it('returns null without guards', () => {
    expect(decodeMarker(new Uint8ClampedArray(FRAME_W * FRAME_H * 4).fill(255))).toBeNull();
  });
  it('value advances every 500 ms and lag wraps', () => {
    expect(markerValue(1500, 0)).toBe(3);
    expect(markerLag(2, 4094)).toBe(4);
  });
});
