/**
 * SMF-6 capture probe — pure logic (no React). Everything here reports what the runtime
 * actually did; nothing is inferred from API presence alone (SMF-6 AC3).
 * Media stays in memory: nothing is recorded, stored or uploaded (SMF-6 AC4).
 */

export type CaptureMode = 'camera' | 'mic' | 'both';

export type CaptureErrorCode =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'SecurityError'
  | 'AbortError'
  | 'TypeError'
  | 'ApiMissing'
  | 'Unknown';

export interface CaptureFailure {
  code: CaptureErrorCode;
  /** Raw error name/message from the runtime, copied verbatim for evidence. */
  raw: string;
  /** What the tester should read: the real outcome, not a guess. */
  explanation: string;
  /** Constraint the runtime could not satisfy (OverconstrainedError only). */
  constraint?: string;
}

const EXPLANATIONS: Record<CaptureErrorCode, string> = {
  NotAllowedError:
    'Permission was denied or the prompt was dismissed (by the user, the browser, the OS, or the host app policy). Retry after changing the permission.',
  NotFoundError: 'No device of the requested kind is available to this page.',
  NotReadableError: 'The device exists but could not be started (in use by another app, or a hardware/OS error).',
  OverconstrainedError: 'The requested device or constraint cannot be satisfied (e.g. the selected device is no longer available).',
  SecurityError: 'Blocked by a security policy (insecure context, Permissions-Policy, or host restriction).',
  AbortError: 'The request was aborted by the runtime before a device started.',
  TypeError: 'The request was invalid or media capture is not supported in this context.',
  ApiMissing: 'navigator.mediaDevices.getUserMedia is not available in this host/context.',
  Unknown: 'Unexpected failure; see the raw error.',
};

function isNamed(e: unknown): e is { name: string; message?: string; constraint?: string } {
  return typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string';
}

/** Map a getUserMedia/getDisplayMedia rejection to an explicit, reportable outcome. */
export function mapMediaError(e: unknown): CaptureFailure {
  if (!isNamed(e)) {
    return { code: 'Unknown', raw: String(e), explanation: EXPLANATIONS.Unknown };
  }
  const known: CaptureErrorCode[] = [
    'NotAllowedError',
    'NotFoundError',
    'NotReadableError',
    'OverconstrainedError',
    'SecurityError',
    'AbortError',
    'TypeError',
    'ApiMissing',
  ];
  // Older WebKit/Chromium aliases.
  const aliases: Record<string, CaptureErrorCode> = {
    PermissionDeniedError: 'NotAllowedError',
    DevicesNotFoundError: 'NotFoundError',
    TrackStartError: 'NotReadableError',
    ConstraintNotSatisfiedError: 'OverconstrainedError',
  };
  const code: CaptureErrorCode = (known as string[]).includes(e.name)
    ? (e.name as CaptureErrorCode)
    : (aliases[e.name] ?? 'Unknown');
  const failure: CaptureFailure = {
    code,
    raw: `${e.name}: ${e.message ?? ''}`.trim(),
    explanation: EXPLANATIONS[code],
  };
  if (code === 'OverconstrainedError' && e.constraint) failure.constraint = e.constraint;
  return failure;
}

export function apiMissingFailure(): CaptureFailure {
  return { code: 'ApiMissing', raw: 'navigator.mediaDevices.getUserMedia undefined', explanation: EXPLANATIONS.ApiMissing };
}

/** Constraints for one capture request. A deviceId pins the device with `exact`. */
export function buildConstraints(
  mode: CaptureMode,
  devices: { cameraId?: string; micId?: string } = {},
): MediaStreamConstraints {
  const video: MediaTrackConstraints | boolean = devices.cameraId ? { deviceId: { exact: devices.cameraId } } : true;
  const audio: MediaTrackConstraints | boolean = devices.micId ? { deviceId: { exact: devices.micId } } : true;
  return {
    video: mode === 'mic' ? false : video,
    audio: mode === 'camera' ? false : audio,
  };
}

/** Device id that cannot exist — used to simulate unavailable hardware on any host. */
export const UNAVAILABLE_DEVICE_ID = 'smf6-simulated-unavailable-device';

export interface TrackSnapshot {
  kind: string;
  label: string;
  readyState: string;
  enabled: boolean;
  muted: boolean;
  settings: string;
}

const SETTING_KEYS = ['width', 'height', 'frameRate', 'facingMode', 'sampleRate', 'channelCount', 'echoCancellation', 'noiseSuppression', 'autoGainControl'];

/** Track state for display/evidence. deviceId/groupId are deliberately omitted (stable identifiers). */
export function snapshotTrack(t: MediaStreamTrack): TrackSnapshot {
  const s = (typeof t.getSettings === 'function' ? t.getSettings() : {}) as Record<string, unknown>;
  const settings = SETTING_KEYS.filter(k => s[k] !== undefined)
    .map(k => `${k}=${String(s[k])}`)
    .join(', ');
  return {
    kind: t.kind,
    label: t.label || '(no label)',
    readyState: t.readyState,
    enabled: t.enabled,
    muted: t.muted,
    settings: settings || '(none reported)',
  };
}

/** Stop every track and report the readyState each one ended in. */
export function stopTracks(tracks: readonly MediaStreamTrack[]): string[] {
  return tracks.map(t => {
    t.stop();
    return `${t.kind}:${t.readyState}`;
  });
}

/** Root-mean-square level (0..1) of 8-bit time-domain samples centred on 128. */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length));
}

export interface PolicyReport {
  secureContext: boolean;
  framed: boolean | 'unknown';
  mediaDevicesApi: boolean;
  enumerateDevicesApi: boolean;
  displayMediaApi: boolean;
  /** 'allowed' | 'blocked' | 'not exposed' per feature from document.permissionsPolicy / featurePolicy. */
  policyApi: 'permissionsPolicy' | 'featurePolicy' | 'not exposed';
  camera: string;
  microphone: string;
  displayCapture: string;
}

interface PolicyLike {
  allowsFeature(feature: string): boolean;
}

function readPolicyApi(doc: Document): { api: PolicyReport['policyApi']; policy: PolicyLike | null } {
  const d = doc as Document & { permissionsPolicy?: PolicyLike; featurePolicy?: PolicyLike };
  if (d.permissionsPolicy && typeof d.permissionsPolicy.allowsFeature === 'function') {
    return { api: 'permissionsPolicy', policy: d.permissionsPolicy };
  }
  if (d.featurePolicy && typeof d.featurePolicy.allowsFeature === 'function') {
    return { api: 'featurePolicy', policy: d.featurePolicy };
  }
  return { api: 'not exposed', policy: null };
}

/**
 * What the host exposes. These are observations of the runtime, NOT proof that capture
 * works — only an actual getUserMedia result is (SMF-6 AC3).
 */
export function readPolicyReport(win: Window = window): PolicyReport {
  let framed: boolean | 'unknown';
  try {
    framed = win.self !== win.top;
  } catch {
    framed = true;
  }
  const { api, policy } = readPolicyApi(win.document);
  const allows = (f: string): string => {
    if (!policy) return 'not exposed';
    try {
      return policy.allowsFeature(f) ? 'allowed' : 'blocked';
    } catch {
      return 'error';
    }
  };
  const md = win.navigator.mediaDevices as MediaDevices | undefined;
  return {
    secureContext: win.isSecureContext,
    framed,
    mediaDevicesApi: typeof md?.getUserMedia === 'function',
    enumerateDevicesApi: typeof md?.enumerateDevices === 'function',
    displayMediaApi: typeof md?.getDisplayMedia === 'function',
    policyApi: api,
    camera: allows('camera'),
    microphone: allows('microphone'),
    displayCapture: allows('display-capture'),
  };
}

/** Query the Permissions API for camera/microphone; 'unsupported' where the host throws. */
export async function readPermissionStates(nav: Navigator = navigator): Promise<{ camera: string; microphone: string }> {
  const q = async (name: string): Promise<string> => {
    try {
      if (!nav.permissions?.query) return 'unsupported';
      const r = await nav.permissions.query({ name: name as PermissionName });
      return r.state;
    } catch {
      return 'unsupported';
    }
  };
  return { camera: await q('camera'), microphone: await q('microphone') };
}

export interface LogEntry {
  at: string;
  message: string;
}

export function logEntry(message: string, now: Date = new Date()): LogEntry {
  return { at: now.toISOString(), message };
}

/**
 * Result of the last leave/unmount, kept in memory (not storage) so the tester can
 * navigate away and back and read whether every track ended (CAP-03).
 */
export interface LeaveRecord {
  at: string;
  reason: 'unmount' | 'stop-button' | 'pagehide';
  tracks: string[];
  allEnded: boolean;
  audioContextClosed: boolean;
}

let lastLeave: LeaveRecord | null = null;
export function setLastLeave(r: LeaveRecord): void {
  lastLeave = r;
}
export function getLastLeave(): LeaveRecord | null {
  return lastLeave;
}

export function formatDiagnostics(input: {
  build: string;
  userAgent: string;
  policy: PolicyReport;
  permissions: { camera: string; microphone: string };
  tracks: TrackSnapshot[];
  cameraFrames: number;
  micPeak: number;
  lastFailure: CaptureFailure | null;
  lastLeave: LeaveRecord | null;
  log: LogEntry[];
}): string {
  const p = input.policy;
  const lines = [
    `SMF-6 capture diagnostics`,
    `build: ${input.build}`,
    `captured: ${new Date().toISOString()}`,
    `user agent: ${input.userAgent}`,
    `secure context: ${p.secureContext}; framed: ${String(p.framed)}`,
    `APIs: getUserMedia=${p.mediaDevicesApi} enumerateDevices=${p.enumerateDevicesApi} getDisplayMedia=${p.displayMediaApi}`,
    `policy API: ${p.policyApi}; camera=${p.camera} microphone=${p.microphone} display-capture=${p.displayCapture}`,
    `permission state: camera=${input.permissions.camera} microphone=${input.permissions.microphone}`,
    `live tracks: ${input.tracks.length === 0 ? 'none' : ''}`,
    ...input.tracks.map(t => `  ${t.kind} "${t.label}" readyState=${t.readyState} enabled=${t.enabled} muted=${t.muted} [${t.settings}]`),
    `camera frames rendered (preview): ${input.cameraFrames}`,
    `mic peak level (0..1): ${input.micPeak.toFixed(3)}`,
    `last failure: ${input.lastFailure ? `${input.lastFailure.code} — ${input.lastFailure.raw}` : 'none'}`,
    `last leave: ${input.lastLeave ? `${input.lastLeave.reason} at ${input.lastLeave.at}; ${input.lastLeave.tracks.join(', ') || 'no tracks'}; all ended=${input.lastLeave.allEnded}; audio context closed=${input.lastLeave.audioContextClosed}` : 'none'}`,
    `event log:`,
    ...input.log.map(l => `  ${l.at} ${l.message}`),
  ];
  return lines.join('\n');
}
