#!/usr/bin/env node
/**
 * Deterministic generator for the SMF-13/14 3D fixtures (SMF-3 contract: MF-MODEL-SMALL <= 2 MiB,
 * MF-MODEL-REP <= 10 MiB, missing-asset path, static equipment-image fallback).
 *
 *   node generate-models.mjs            # (re)write GLBs, fallback PNG, bundle copies, manifest.json
 *   node generate-models.mjs --verify   # regenerate in memory; fail if any byte/hash/limit differs
 *
 * Output is synthetic and released as CC0-1.0 by this repository. The geometry is built with
 * three.js primitives (pinned 0.186.1) and written as GLB 2.0 by the small writer below, so no
 * external URIs are ever emitted: every buffer and texture is embedded in the GLB BIN chunk.
 * Textures are procedural (seeded value noise) and encoded by the PNG writer below (Node zlib).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const BUNDLE_ASSETS = resolve(REPO, 'force-app/main/default/uiBundles/FieldSupport/src/probes/smf-13-3d/assets');
const MiB = 1024 * 1024;
const LICENCE = 'CC0-1.0';
const GENERATOR = `CollabTech/salesforce-multi-framework testing/fixtures/models/generate-models.mjs (three ${THREE.REVISION})`;

// ---------------------------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const smooth = t => t * t * (3 - 2 * t);
/** Tileable value noise on a period-`p` lattice. */
function valueNoise(x, y, p, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const w = i => ((i % p) + p) % p;
  const a = hash2(w(x0), w(y0), seed), b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed), d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(u, v, base, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const p = base << o;
    sum += amp * valueNoise(u * p, v * p, p, seed + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}
const clamp8 = v => Math.max(0, Math.min(255, Math.round(v)));

// ---------------------------------------------------------------------------------------------
// PNG writer (8-bit RGB, filter "up" on every row, zlib level 9)
// ---------------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePngRgb(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = y === 0 ? 0 : 2; // None for row 0, Up for the rest
    for (let x = 0; x < stride; x++) {
      const cur = rgb[y * stride + x];
      raw[o + 1 + x] = y === 0 ? cur : (cur - rgb[(y - 1) * stride + x]) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// Procedural textures (MF-MODEL-REP only)
// ---------------------------------------------------------------------------------------------
function paintTexture(size, base, seed) {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm(u, v, 8, 6, seed);           // paint mottling
      const g = fbm(u, v, 4, 3, seed + 101);     // grime
      const chip = valueNoise(u * 96, v * 96, 96, seed + 7) > 0.93 ? 0.55 : 1; // paint chips
      const shade = (0.82 + 0.3 * n) * (1 - 0.25 * Math.max(0, g - 0.55) * 2) * chip;
      const i = (y * size + x) * 3;
      out[i] = clamp8(base[0] * shade);
      out[i + 1] = clamp8(base[1] * shade);
      out[i + 2] = clamp8(base[2] * shade);
    }
  }
  return out;
}
function normalTexture(size, seed, strength) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = fbm(x / size, y / size, 16, 5, seed);
  const out = new Uint8Array(size * size * 3);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 3;
      out[i] = clamp8((-dx / l * 0.5 + 0.5) * 255);
      out[i + 1] = clamp8((-dy / l * 0.5 + 0.5) * 255);
      out[i + 2] = clamp8((1 / l * 0.5 + 0.5) * 255);
    }
  }
  return out;
}
function metalRoughTexture(size, seed, roughBase, metal) {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size, y / size, 8, 4, seed);
      const i = (y * size + x) * 3;
      out[i] = 255; // unused (occlusion channel left white)
      out[i + 1] = clamp8((roughBase + (n - 0.5) * 0.35) * 255); // G = roughness
      out[i + 2] = clamp8(metal * 255); // B = metalness
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pump geometry. Axis of the pump shaft is +X; Y is up; units are metres.
// ---------------------------------------------------------------------------------------------
const PARTS = [
  { name: 'Base', partId: 'MF-PART-BASE', label: 'Base skid', color: [0.18, 0.2, 0.22], metal: 0.6, rough: 0.6 },
  { name: 'Casing', partId: 'MF-PART-CASING', label: 'Pump casing (volute)', color: [0.1, 0.32, 0.62], metal: 0.3, rough: 0.45, tex: 'casing' },
  { name: 'Inlet', partId: 'MF-PART-INLET', label: 'Suction inlet', color: [0.12, 0.4, 0.7], metal: 0.3, rough: 0.45, tex: 'casing' },
  { name: 'Outlet', partId: 'MF-PART-OUTLET', label: 'Discharge outlet', color: [0.12, 0.4, 0.7], metal: 0.3, rough: 0.45, tex: 'casing' },
  { name: 'Impeller', partId: 'MF-PART-IMPELLER', label: 'Impeller', color: [0.78, 0.55, 0.2], metal: 0.9, rough: 0.3 },
  { name: 'BearingHousing', partId: 'MF-PART-BEARING', label: 'Bearing housing', color: [0.1, 0.32, 0.62], metal: 0.3, rough: 0.5, tex: 'casing' },
  { name: 'Coupling', partId: 'MF-PART-COUPLING', label: 'Shaft coupling', color: [0.85, 0.65, 0.1], metal: 0.5, rough: 0.4 },
  { name: 'Motor', partId: 'MF-PART-MOTOR', label: 'Electric motor', color: [0.55, 0.58, 0.6], metal: 0.4, rough: 0.5, tex: 'motor' },
  { name: 'TerminalBox', partId: 'MF-PART-TERMINAL', label: 'Motor terminal box', color: [0.45, 0.48, 0.5], metal: 0.4, rough: 0.55, tex: 'motor' },
  { name: 'Fasteners', partId: 'MF-PART-FASTENERS', label: 'Flange bolts', color: [0.7, 0.72, 0.74], metal: 1.0, rough: 0.35 },
];

function cylX(r, len, seg, hSeg, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, hSeg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
function cylY(r, len, seg, hSeg, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, hSeg);
  g.translate(x, y, z);
  return g;
}
function box(w, h, d, x, y, z, seg = 1) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  g.translate(x, y, z);
  return g;
}

function buildPump(d) {
  const cy = 0.4; // shaft height
  const geo = {};
  geo.Base = [box(1.7, 0.08, 0.62, 0.0, 0.04, 0, d.boxSeg), box(0.3, 0.12, 0.4, -0.35, 0.14, 0, d.boxSeg), box(0.6, 0.06, 0.44, 0.38, 0.11, 0, d.boxSeg)];
  // Volute: torus ring around the shaft axis plus a back plate.
  const torus = new THREE.TorusGeometry(0.25, 0.11, d.torusRadial, d.torusTubular);
  torus.rotateY(Math.PI / 2);
  torus.translate(-0.38, cy, 0);
  geo.Casing = [torus, cylX(0.34, 0.05, d.radial, d.hSeg, -0.29, cy, 0)];
  geo.Inlet = [cylX(0.09, 0.32, d.radial, d.hSeg, -0.68, cy, 0), cylX(0.15, 0.035, d.radial, 1, -0.84, cy, 0)];
  geo.Outlet = [cylY(0.075, 0.36, d.radial, d.hSeg, -0.38, cy + 0.36, 0.12), cylY(0.13, 0.035, d.radial, 1, -0.38, cy + 0.55, 0.12)];
  const imp = [cylX(0.055, 0.08, d.radial, 2, -0.4, cy, 0)];
  for (let i = 0; i < d.blades; i++) {
    const b = new THREE.BoxGeometry(0.03, 0.09, 0.012, d.boxSeg, d.boxSeg, 1);
    b.translate(0, 0.1, 0);
    b.rotateY(0.35); // blade pitch
    b.rotateX((i / d.blades) * Math.PI * 2);
    b.translate(-0.4, cy, 0);
    imp.push(b);
  }
  geo.Impeller = imp;
  geo.BearingHousing = [cylX(0.12, 0.22, d.radial, d.hSeg, -0.14, cy, 0)];
  geo.Coupling = [cylX(0.035, 0.18, d.radial, 2, 0.0, cy, 0), cylX(0.08, 0.06, d.radial, 2, 0.0, cy, 0)];
  const motor = [cylX(0.22, 0.6, d.radial, d.hSeg, 0.38, cy, 0), cylX(0.2, 0.08, d.radial, 2, 0.72, cy, 0)];
  for (let i = 0; i < d.fins; i++) {
    const a = (i / d.fins) * Math.PI * 2;
    if (Math.sin(a) < -0.6) continue; // no fins under the motor feet
    const f = new THREE.BoxGeometry(0.56, 0.03, 0.008, d.finSeg, 1, 1);
    f.translate(0, 0.235, 0);
    f.rotateX(a);
    f.translate(0.38, cy, 0);
    motor.push(f);
  }
  geo.Motor = motor;
  geo.TerminalBox = [box(0.16, 0.1, 0.16, 0.38, cy + 0.27, 0, d.boxSeg)];
  const bolts = [];
  const ring = (n, r, at) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      bolts.push(at(Math.cos(a) * r, Math.sin(a) * r));
    }
  };
  ring(8, 0.125, (u, v) => cylX(0.012, 0.06, d.boltSeg, 1, -0.84, cy + u, v));
  ring(8, 0.105, (u, v) => cylY(0.012, 0.06, d.boltSeg, 1, -0.38 + u, cy + 0.55, 0.12 + v));
  ring(d.casingBolts, 0.31, (u, v) => cylX(0.014, 0.08, d.boltSeg, 1, -0.29, cy + u, v));
  geo.Fasteners = bolts;
  return PARTS.map(p => {
    const merged = mergeGeometries(geo[p.name], false);
    if (!merged) throw new Error(`merge failed for ${p.name}`);
    return { ...p, geometry: merged };
  });
}

const VARIANTS = {
  'MF-MODEL-SMALL': {
    file: 'MF-MODEL-SMALL.glb',
    limit: 2 * MiB,
    detail: { radial: 48, hSeg: 2, torusRadial: 24, torusTubular: 96, blades: 6, fins: 24, finSeg: 1, boxSeg: 1, boltSeg: 8, casingBolts: 8 },
    textures: false,
  },
  'MF-MODEL-REP': {
    file: 'MF-MODEL-REP.glb',
    limit: 10 * MiB,
    detail: { radial: 256, hSeg: 32, torusRadial: 128, torusTubular: 512, blades: 7, fins: 40, finSeg: 32, boxSeg: 8, boltSeg: 32, casingBolts: 16 },
    textures: true,
  },
};

// ---------------------------------------------------------------------------------------------
// GLB writer
// ---------------------------------------------------------------------------------------------
function buildGlb(fixtureId, parts, withTextures) {
  const bin = [];
  let binLen = 0;
  const bufferViews = [];
  const accessors = [];
  const addView = (bytes, target) => {
    const pad = (4 - (binLen % 4)) % 4;
    if (pad) { bin.push(Buffer.alloc(pad)); binLen += pad; }
    const view = { buffer: 0, byteOffset: binLen, byteLength: bytes.byteLength };
    if (target) view.target = target;
    bin.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    binLen += bytes.byteLength;
    bufferViews.push(view);
    return bufferViews.length - 1;
  };
  const addAccessor = (arr, type, componentType, target, minmax) => {
    const itemSize = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const acc = { bufferView: addView(arr, target), componentType, count: arr.length / itemSize, type };
    if (minmax) Object.assign(acc, minmax);
    accessors.push(acc);
    return accessors.length - 1;
  };

  const images = [], textures = [], textureInfo = [];
  const texSets = {};
  if (withTextures) {
    const tex = (name, size, rgb) => {
      const png = encodePngRgb(size, size, rgb);
      images.push({ name, mimeType: 'image/png', bufferView: addView(new Uint8Array(png), undefined) });
      textures.push({ sampler: 0, source: images.length - 1, name });
      textureInfo.push({ name, width: size, height: size, bytes: png.length, format: 'PNG RGB8' });
      return textures.length - 1;
    };
    const normal = tex('cast-normal', 1024, normalTexture(1024, 41, 6));
    texSets.casing = { base: tex('casing-paint', 1024, paintTexture(1024, [235, 245, 255], 11)), normal, mr: tex('casing-metal-rough', 512, metalRoughTexture(512, 23, 0.5, 0.3)) };
    texSets.motor = { base: tex('motor-paint', 1024, paintTexture(1024, [245, 245, 245], 31)), normal };
  }

  const materials = [], meshes = [], nodes = [];
  const partStats = [];
  let triangles = 0, vertices = 0;
  for (const p of parts) {
    const g = p.geometry;
    const pos = g.getAttribute('position').array;
    const nrm = g.getAttribute('normal').array;
    const uv = g.getAttribute('uv').array;
    const idx = g.getIndex().array;
    const vcount = pos.length / 3;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
    const indices = vcount < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx);
    const attributes = {
      POSITION: addAccessor(Float32Array.from(pos), 'VEC3', 5126, 34962, { min, max }),
      NORMAL: addAccessor(Float32Array.from(nrm), 'VEC3', 5126, 34962),
      TEXCOORD_0: addAccessor(Float32Array.from(uv), 'VEC2', 5126, 34962),
    };
    const indAcc = addAccessor(indices, 'SCALAR', indices instanceof Uint16Array ? 5123 : 5125, 34963);
    const set = p.tex && texSets[p.tex];
    const mat = {
      name: `${p.name}-material`,
      pbrMetallicRoughness: {
        baseColorFactor: [...p.color, 1],
        metallicFactor: set?.mr !== undefined ? 1 : p.metal,
        roughnessFactor: set?.mr !== undefined ? 1 : p.rough,
      },
    };
    if (set) {
      mat.pbrMetallicRoughness.baseColorTexture = { index: set.base };
      if (set.mr !== undefined) mat.pbrMetallicRoughness.metallicRoughnessTexture = { index: set.mr };
      mat.normalTexture = { index: set.normal, scale: 1 };
    }
    materials.push(mat);
    meshes.push({ name: p.name, primitives: [{ attributes, indices: indAcc, material: materials.length - 1, mode: 4 }] });
    nodes.push({ name: p.name, mesh: meshes.length - 1, extras: { partId: p.partId, label: p.label } });
    const tri = idx.length / 3;
    triangles += tri;
    vertices += vcount;
    partStats.push({ name: p.name, partId: p.partId, label: p.label, triangles: tri, vertices: vcount });
  }
  nodes.push({ name: 'MF-PUMP-001', children: parts.map((_, i) => i), extras: { fixture: fixtureId } });

  const json = {
    asset: { version: '2.0', generator: GENERATOR, copyright: `${LICENCE} — synthetic fixture generated by this repository` },
    scene: 0,
    scenes: [{ name: fixtureId, nodes: [nodes.length - 1], extras: { fixture: fixtureId, licence: LICENCE } }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: 0 }],
  };
  if (images.length) {
    json.images = images;
    json.textures = textures;
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  }
  const binPad = (4 - (binLen % 4)) % 4;
  const binBuf = Buffer.concat([...bin, Buffer.alloc(binPad)]);
  json.buffers[0].byteLength = binBuf.length;
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  const glb = Buffer.concat([header, ch(jsonBuf.length, 0x4e4f534a), jsonBuf, ch(binBuf.length, 0x004e4942), binBuf]);
  return {
    glb,
    stats: {
      triangles, vertices, meshes: meshes.length, primitives: meshes.length, nodes: nodes.length,
      materials: materials.length, textures: textureInfo, textureCount: textureInfo.length,
      externalUris: 0, parts: partStats,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Static fallback: software-rendered (z-buffer, Lambert) view of MF-MODEL-SMALL
// ---------------------------------------------------------------------------------------------
function renderFallback(parts, width, height, ss) {
  const W = width * ss, H = height * ss;
  const color = new Float32Array(W * H * 3);
  const depth = new Float32Array(W * H).fill(Infinity);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      color[i] = 0.93 - 0.08 * t; color[i + 1] = 0.95 - 0.07 * t; color[i + 2] = 0.97 - 0.05 * t;
    }
  }
  const cam = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
  cam.position.set(-1.9, 1.35, 2.3);
  cam.lookAt(-0.05, 0.38, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const L1 = new THREE.Vector3(-0.5, 0.9, 0.6).normalize();
  const L2 = new THREE.Vector3(0.7, 0.3, -0.4).normalize();
  const v = new THREE.Vector4();
  for (const p of parts) {
    const pos = p.geometry.getAttribute('position').array;
    const nrm = p.geometry.getAttribute('normal').array;
    const idx = p.geometry.getIndex().array;
    const sx = new Float32Array(pos.length / 3), sy = new Float32Array(pos.length / 3), sz = new Float32Array(pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) {
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 1).applyMatrix4(vp);
      sx[i] = (v.x / v.w * 0.5 + 0.5) * W;
      sy[i] = (1 - (v.y / v.w * 0.5 + 0.5)) * H;
      sz[i] = v.z / v.w;
    }
    const lin = p.color.map(c => Math.pow(c, 1 / 2.2)); // display-ish colour
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sy[b] - sy[a]) * (sx[c] - sx[a]);
      if (area === 0) continue;
      const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c])));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
      const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c])));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((sx[b] - px) * (sy[c] - py) - (sy[b] - py) * (sx[c] - px)) / area;
          const w1 = ((sx[c] - px) * (sy[a] - py) - (sy[c] - py) * (sx[a] - px)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
          const di = y * W + x;
          if (z >= depth[di]) continue;
          depth[di] = z;
          let nx = w0 * nrm[a * 3] + w1 * nrm[b * 3] + w2 * nrm[c * 3];
          let ny = w0 * nrm[a * 3 + 1] + w1 * nrm[b * 3 + 1] + w2 * nrm[c * 3 + 1];
          let nz = w0 * nrm[a * 3 + 2] + w1 * nrm[b * 3 + 2] + w2 * nrm[c * 3 + 2];
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          const d1 = Math.abs(nx * L1.x + ny * L1.y + nz * L1.z);
          const d2 = Math.max(0, nx * L2.x + ny * L2.y + nz * L2.z);
          const s = 0.35 + 0.65 * d1 + 0.2 * d2;
          const ci = di * 3;
          color[ci] = lin[0] * s; color[ci + 1] = lin[1] * s; color[ci + 2] = lin[2] * s;
        }
      }
    }
  }
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) sum += color[((y * ss + j) * W + (x * ss + i)) * 3 + k];
        out[(y * width + x) * 3 + k] = clamp8((sum / (ss * ss)) * 255);
      }
    }
  }
  return encodePngRgb(width, height, out);
}

// ---------------------------------------------------------------------------------------------
async function validate(glb) {
  const { validateBytes } = await import('gltf-validator');
  const report = await validateBytes(new Uint8Array(glb), { maxIssues: 50 });
  return { validator: report.validatorVersion, errors: report.issues.numErrors, warnings: report.issues.numWarnings, infos: report.issues.numInfos, messages: report.issues.messages.filter(m => m.severity === 0).map(m => `${m.code} ${m.pointer ?? ''}`) };
}
const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const rel = p => relative(REPO, p).split('\\').join('/');

async function main() {
  const verify = process.argv.includes('--verify');
  const outputs = new Map(); // abs path -> Buffer
  const manifest = {
    manifest_version: '1.0.0',
    note: 'SMF-13/14 3D fixtures (SMF-3 MF-MODEL-SMALL / MF-MODEL-REP). Synthetic, generated deterministically by this repository; no third-party assets. Regenerate: cd testing/fixtures/models && npm ci && npm run generate. Verify: npm run verify.',
    licence: LICENCE,
    provenance: 'Procedural geometry (three.js primitives) and procedural PNG textures (seeded value noise); written by generate-models.mjs. No external URIs: buffers and images are embedded in the GLB BIN chunk.',
    generator: { command: 'cd testing/fixtures/models && npm ci && node generate-models.mjs', script: 'testing/fixtures/models/generate-models.mjs', node: process.version, three: THREE.REVISION, validator: 'gltf-validator 2.0.0-dev.3.10' },
    models: [],
  };
  let smallParts = null;
  for (const [id, cfg] of Object.entries(VARIANTS)) {
    const parts = buildPump(cfg.detail);
    if (id === 'MF-MODEL-SMALL') smallParts = parts;
    const { glb, stats } = buildGlb(id, parts, cfg.textures);
    if (glb.length > cfg.limit) throw new Error(`${id} is ${glb.length} bytes, over its ${cfg.limit}-byte limit`);
    const report = await validate(glb);
    if (report.errors) throw new Error(`${id} failed glTF validation: ${report.messages.join('; ')}`);
    const abs = resolve(HERE, cfg.file);
    outputs.set(abs, glb);
    const entry = {
      id, path: rel(abs), bytes: glb.length, mib: +(glb.length / MiB).toFixed(3), limit_bytes: cfg.limit, sha256: sha256(glb),
      format: 'glTF 2.0 binary (GLB), single buffer, embedded images', ...stats,
      textureResolutions: stats.textures.map(t => `${t.width}x${t.height}`),
      gltfValidator: report, licence: LICENCE,
    };
    if (id === 'MF-MODEL-SMALL') {
      const copy = resolve(BUNDLE_ASSETS, 'MF-MODEL-SMALL.glb');
      outputs.set(copy, glb);
      entry.bundleCopy = rel(copy);
    }
    manifest.models.push(entry);
  }
  const png = renderFallback(smallParts, 960, 640, 3);
  const fallbackPath = resolve(HERE, 'MF-MODEL-FALLBACK.png');
  const fallbackCopy = resolve(BUNDLE_ASSETS, 'mf-pump-fallback.png');
  outputs.set(fallbackPath, png);
  outputs.set(fallbackCopy, png);
  manifest.fallbackImage = {
    id: 'MF-MODEL-FALLBACK', path: rel(fallbackPath), bundleCopy: rel(fallbackCopy), bytes: png.length, sha256: sha256(png),
    width: 960, height: 640, format: 'PNG RGB8, no metadata chunks (no EXIF/location)',
    method: 'Software z-buffer rendering of MF-MODEL-SMALL geometry (Lambert shading, 3x3 supersampling) by generate-models.mjs',
    alt: 'Static rendering of synthetic pump MF-PUMP-001: blue pump casing with the suction inlet facing forward and the discharge outlet on top, a yellow shaft coupling, and a grey finned electric motor with a terminal box, all on a dark base skid.',
    licence: LICENCE,
  };
  const missing = resolve(HERE, 'MF-MODEL-MISSING.glb');
  manifest.missingAsset = {
    id: 'MF-MODEL-MISSING',
    path: rel(missing),
    bundlePath: 'src/probes/smf-13-3d/assets/MF-MODEL-MISSING.glb (never emitted; the probe requests it to exercise load failure)',
    filesControl: 'A ContentVersion Id that does not resolve for the caller (SMF-14 BUDGET-03 uses the MF-CASE-002 copy for denial and a non-existent Id for missing).',
    rule: 'This file must not exist. --verify fails if it does.',
  };
  if (existsSync(missing)) throw new Error('MF-MODEL-MISSING.glb must not exist');
  const manifestPath = resolve(HERE, 'manifest.json');
  outputs.set(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'));
  // Compact copy the probes import (expected hashes and complexity for on-device evidence).
  const compact = {
    source: 'testing/fixtures/models/manifest.json (generated; do not edit)',
    licence: LICENCE,
    models: manifest.models.map(m => ({
      id: m.id, bytes: m.bytes, sha256: m.sha256, triangles: m.triangles, vertices: m.vertices, meshes: m.meshes,
      materials: m.materials, textureCount: m.textureCount, textureResolutions: m.textureResolutions,
      parts: m.parts.map(p => ({ name: p.name, partId: p.partId, label: p.label })),
    })),
    fallback: { sha256: manifest.fallbackImage.sha256, alt: manifest.fallbackImage.alt, width: 960, height: 640 },
  };
  outputs.set(resolve(BUNDLE_ASSETS, 'fixture-manifest.json'), Buffer.from(JSON.stringify(compact, null, 2) + '\n', 'utf8'));

  let mismatches = 0;
  for (const [abs, buf] of outputs) {
    if (verify) {
      const ok = existsSync(abs) && sha256(readFileSync(abs)) === sha256(buf);
      if (!ok) { mismatches++; console.error(`MISMATCH ${rel(abs)}`); } else console.log(`ok ${rel(abs)}`);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, buf);
      console.log(`wrote ${rel(abs)} (${buf.length} bytes)`);
    }
  }
  for (const m of manifest.models) console.log(`${m.id}: ${m.bytes} B, ${m.triangles} tris, ${m.meshes} meshes, ${m.textureCount} textures, sha256 ${m.sha256}`);
  if (mismatches) {
    console.error(`${mismatches} output(s) differ from the committed fixtures (Node ${process.version}; zlib or three version drift changes bytes).`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
