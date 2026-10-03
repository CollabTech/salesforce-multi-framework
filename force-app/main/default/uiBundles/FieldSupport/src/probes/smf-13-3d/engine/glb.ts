/**
 * Static GLB inspection (no WebGL): validates the container and lists every URI the file
 * references, so evidence can show that model and textures are self-contained and the loader
 * has no external URL to fetch (BUDGET-03).
 */
export interface GlbInspection {
  ok: boolean;
  error?: string;
  version?: number;
  byteLength: number;
  jsonBytes?: number;
  binBytes?: number;
  /** URIs on buffers/images that are not data: URIs (would cause a network request). */
  externalUris: string[];
  dataUris: number;
  embeddedImages: number;
  generator?: string;
  copyright?: string;
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

interface GltfJson {
  asset?: { generator?: string; copyright?: string };
  buffers?: { uri?: string }[];
  images?: { uri?: string; bufferView?: number }[];
}

function isGltfJson(v: unknown): v is GltfJson {
  return typeof v === 'object' && v !== null && 'asset' in v;
}

export function inspectGlb(buffer: ArrayBuffer): GlbInspection {
  const base: GlbInspection = { ok: false, byteLength: buffer.byteLength, externalUris: [], dataUris: 0, embeddedImages: 0 };
  if (buffer.byteLength < 20) return { ...base, error: `too small to be a GLB (${buffer.byteLength} bytes)` };
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== GLB_MAGIC) {
    const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(32, buffer.byteLength))).replace(/\s+/g, ' ');
    return { ...base, error: `not a GLB: first bytes "${head}"` };
  }
  const version = dv.getUint32(4, true);
  const declared = dv.getUint32(8, true);
  if (declared !== buffer.byteLength) return { ...base, version, error: `declared length ${declared} != received ${buffer.byteLength}` };
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== CHUNK_JSON) return { ...base, version, error: 'first chunk is not JSON' };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  } catch (e) {
    return { ...base, version, error: `JSON chunk does not parse: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isGltfJson(json)) return { ...base, version, error: 'JSON chunk has no asset block' };
  let binBytes = 0;
  const binOffset = 20 + jsonLen;
  if (binOffset + 8 <= buffer.byteLength && dv.getUint32(binOffset + 4, true) === CHUNK_BIN) binBytes = dv.getUint32(binOffset, true);
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map(o => o.uri).filter((u): u is string => typeof u === 'string');
  return {
    ...base,
    ok: true,
    version,
    jsonBytes: jsonLen,
    binBytes,
    externalUris: uris.filter(u => !u.startsWith('data:')),
    dataUris: uris.filter(u => u.startsWith('data:')).length,
    embeddedImages: (json.images ?? []).filter(i => typeof i.bufferView === 'number').length,
    generator: json.asset?.generator,
    copyright: json.asset?.copyright,
  };
}

/** Hex SHA-256 via Web Crypto (secure contexts; Salesforce hosts and localhost qualify). */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
