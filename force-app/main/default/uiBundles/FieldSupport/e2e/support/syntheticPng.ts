import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

// Minimal PNG encoder for a synthetic "pump" stand-in (grey body, dark inlet rectangle on the
// left). Localhost tests only; it is not the SMF-3 MF-IMAGE-001 asset. No metadata chunks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Inlet rectangle in image pixels (used to aim the red circle). */
export const INLET = { x: 80, y: 220, w: 120, h: 160 };

export function syntheticPumpPng(width = 800, height = 600): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const inlet = x >= INLET.x && x < INLET.x + INLET.w && y >= INLET.y && y < INLET.y + INLET.h;
      const body = x >= 160 && x < 680 && y >= 150 && y < 450;
      const v = inlet ? 40 : body ? 150 : 225;
      raw.fill(v, row + 1 + x * 3, row + 4 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
