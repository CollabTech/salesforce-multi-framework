/**
 * WebGL availability check. Detection alone never earns a PASS (SMF-13 evidence rule); it only
 * decides between the 3D view and the static fallback and records what the host reports.
 */
export interface WebGLSupport {
  available: boolean;
  webgl2: boolean;
  webgl1: boolean;
  vendor: string | null;
  renderer: string | null;
  maxTextureSize: number | null;
  reason?: string;
}

export function detectWebGL(doc: Document = document): WebGLSupport {
  const none: WebGLSupport = { available: false, webgl2: false, webgl1: false, vendor: null, renderer: null, maxTextureSize: null };
  let canvas: HTMLCanvasElement;
  try {
    canvas = doc.createElement('canvas');
  } catch (e) {
    return { ...none, reason: `canvas unavailable: ${e instanceof Error ? e.message : String(e)}` };
  }
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  let webgl2 = false;
  try {
    gl = canvas.getContext('webgl2');
    webgl2 = gl !== null;
    if (!gl) gl = canvas.getContext('webgl');
  } catch {
    gl = null;
  }
  if (!gl) return { ...none, reason: 'getContext("webgl2"/"webgl") returned null' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const result: WebGLSupport = {
    available: true,
    webgl2,
    webgl1: !webgl2,
    vendor: String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
    renderer: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
  };
  gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe context immediately
  return result;
}

/** Device / network indicators the browser exposes (many are Chromium-only; null when absent). */
export interface DeviceIndicators {
  hardwareConcurrency: number | null;
  deviceMemoryGiB: number | null;
  jsHeapUsedMiB: number | null;
  jsHeapLimitMiB: number | null;
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  devicePixelRatio: number;
  viewport: string;
  orientation: string | null;
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
}
interface PerformanceMemory {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

export function readDeviceIndicators(win: Window = window): DeviceIndicators {
  const nav = win.navigator as Navigator & NavigatorExtras;
  const mem = (win.performance as Performance & PerformanceMemory).memory;
  const mib = (v: number | undefined): number | null => (typeof v === 'number' ? Math.round((v / 1048576) * 10) / 10 : null);
  return {
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemoryGiB: nav.deviceMemory ?? null,
    jsHeapUsedMiB: mib(mem?.usedJSHeapSize),
    jsHeapLimitMiB: mib(mem?.jsHeapSizeLimit),
    effectiveType: nav.connection?.effectiveType ?? null,
    downlinkMbps: nav.connection?.downlink ?? null,
    rttMs: nav.connection?.rtt ?? null,
    devicePixelRatio: win.devicePixelRatio,
    viewport: `${win.innerWidth}x${win.innerHeight}`,
    orientation: win.screen?.orientation?.type ?? null,
  };
}
