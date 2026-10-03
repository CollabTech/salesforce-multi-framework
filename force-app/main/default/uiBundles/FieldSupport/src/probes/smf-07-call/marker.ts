/**
 * SMF-7 CALL-01 changing visual marker. The sender composites the camera frame with a
 * counter (as text for humans and as a 12-bit block strip for machines) into the outgoing video;
 * the receiver decodes the strip from the remote video. Decoded values prove the marker
 * travelled through the call (video seen remotely), and sender-vs-receiver values give a rough
 * end-to-end video delay. Pure functions here; canvas plumbing lives in the probe.
 */

export const MARKER_BITS = 12;
export const MARKER_PERIOD_MS = 500;
export const FRAME_W = 640;
export const FRAME_H = 360;
const BLOCK = Math.floor(FRAME_W / (MARKER_BITS + 2)); // two guard blocks
const STRIP_Y = FRAME_H - BLOCK;

/** Fixed CALL-01 test phrase each participant reads aloud (human-attested). */
export const TEST_PHRASE = 'Pump inlet check: seven, three, nine — overheating at the bearing.';

export function markerValue(nowMs: number, startMs: number): number {
  return Math.floor((nowMs - startMs) / MARKER_PERIOD_MS) % (1 << MARKER_BITS);
}

export function toBits(value: number): number[] {
  return Array.from({ length: MARKER_BITS }, (_, i) => (value >> (MARKER_BITS - 1 - i)) & 1);
}

export function fromBits(bits: number[]): number {
  return bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0);
}

/** Block centre (x, y) for bit i, including the left guard block. */
export function blockCentre(i: number): [number, number] {
  return [BLOCK * (i + 1) + Math.floor(BLOCK / 2), STRIP_Y + Math.floor(BLOCK / 2)];
}

/** Draw the strip: black guard, 12 white/black bits, white guard. */
export function drawMarker(ctx: CanvasRenderingContext2D, value: number, label: string): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, STRIP_Y, FRAME_W, BLOCK);
  toBits(value).forEach((b, i) => {
    ctx.fillStyle = b ? '#fff' : '#000';
    ctx.fillRect(BLOCK * (i + 1), STRIP_Y, BLOCK, BLOCK);
  });
  ctx.fillStyle = '#fff';
  ctx.fillRect(BLOCK * (MARKER_BITS + 1), STRIP_Y, BLOCK, BLOCK);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, FRAME_W, 44);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`${label} #${value}`, 12, 32);
}

/**
 * Decode from RGBA pixels of a FRAME_W x FRAME_H image. Returns null when the guard blocks are
 * not found (no marker, wrong scale, or heavy compression).
 */
export function decodeMarker(rgba: Uint8ClampedArray, width = FRAME_W, height = FRAME_H): number | null {
  const sx = width / FRAME_W;
  const sy = height / FRAME_H;
  const lum = (x: number, y: number): number => {
    const px = Math.min(width - 1, Math.round(x * sx));
    const py = Math.min(height - 1, Math.round(y * sy));
    const o = (py * width + px) * 4;
    return 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  };
  const [lx, ly] = [Math.floor(BLOCK / 2), STRIP_Y + Math.floor(BLOCK / 2)];
  const [rx, ry] = [BLOCK * (MARKER_BITS + 1) + Math.floor(BLOCK / 2), ly];
  if (lum(lx, ly) > 80 || lum(rx, ry) < 170) return null;
  const bits = Array.from({ length: MARKER_BITS }, (_, i) => {
    const [x, y] = blockCentre(i);
    return lum(x, y) > 128 ? 1 : 0;
  });
  return fromBits(bits);
}

/** Smallest forward distance between two marker values (handles wrap-around). */
export function markerLag(sent: number, received: number): number {
  const m = 1 << MARKER_BITS;
  return (((sent - received) % m) + m) % m;
}
