import { inspectGlb, sha256Hex, type GlbInspection } from './glb';

/** Bytes plus the timing marks taken around the request (performance.now() values). */
export interface FetchedModel {
  bytes: ArrayBuffer;
  requestStart: number;
  bytesReceivedAt: number;
  status: number;
  contentType: string | null;
  sha256: string | null;
  inspection: GlbInspection;
}

export type ModelErrorKind = 'missing' | 'denied' | 'invalid' | 'network';

export class ModelLoadError extends Error {
  readonly kind: ModelErrorKind;
  readonly status: number | null;
  constructor(kind: ModelErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'ModelLoadError';
    this.kind = kind;
    this.status = status;
  }
}

export function classifyStatus(status: number): ModelErrorKind {
  if (status === 401 || status === 403) return 'denied';
  if (status === 404 || status === 410) return 'missing';
  return 'network';
}

/**
 * Validates fetched bytes as a self-contained GLB. A 200 response that is not a GLB (for example
 * an SPA fallback page served for a missing asset path) is reported as 'invalid', not success.
 */
export async function acceptModelBytes(bytes: ArrayBuffer, meta: { requestStart: number; bytesReceivedAt: number; status: number; contentType: string | null }): Promise<FetchedModel> {
  const inspection = inspectGlb(bytes);
  if (!inspection.ok) throw new ModelLoadError('invalid', `response is not a usable GLB (${inspection.error}; content-type ${meta.contentType ?? 'none'})`, meta.status);
  if (inspection.externalUris.length) throw new ModelLoadError('invalid', `GLB references external URIs: ${inspection.externalUris.join(', ')}`, meta.status);
  return { bytes, ...meta, sha256: await sha256Hex(bytes), inspection };
}

/**
 * Fetches a model packaged in the app bundle (SMF-13). This is a static app asset: anyone who can
 * load the app bundle can load it — it is NOT checked against case or Files sharing.
 */
export async function fetchBundledModel(url: string): Promise<FetchedModel> {
  const requestStart = performance.now();
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    throw new ModelLoadError('network', `request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new ModelLoadError(classifyStatus(res.status), `HTTP ${res.status} for the model asset`, res.status);
  const bytes = await res.arrayBuffer();
  return acceptModelBytes(bytes, { requestStart, bytesReceivedAt: performance.now(), status: res.status, contentType: res.headers.get('content-type') });
}
