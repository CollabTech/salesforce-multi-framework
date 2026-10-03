/**
 * SMF-7: provider-neutral call client used by the probe UI. The RealtimeKit implementation is
 * in rtkClient.ts; unit tests use a fake. Later media stories (SMF-8 screen share, SMF-9
 * recovery) extend this interface instead of touching the SDK directly.
 */

export interface RemoteParticipant {
  id: string;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

export interface LocalMedia {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

/** Socket (signaling) and media transport states as reported by the SDK. */
export interface ConnectionState {
  socket: string;
  reconnectAttempt: number;
  send: string;
  recv: string;
}

export type CallEvent =
  | { type: 'remotes' }
  | { type: 'local' }
  | { type: 'connection'; state: ConnectionState }
  | { type: 'roomJoined'; reconnected: boolean }
  | { type: 'roomLeft'; state: string }
  | { type: 'autoplayBlocked' }
  | { type: 'mediaPermissionError'; kind: string; message: string };

export interface CallClient {
  /** Opaque id of the local participant in this session (not a Salesforce id). */
  selfId(): string;
  join(): Promise<void>;
  leave(): Promise<void>;
  setMic(on: boolean): Promise<void>;
  /** `track` replaces the camera with a custom track (the marker composite). */
  setCamera(on: boolean, track?: MediaStreamTrack): Promise<void>;
  /** Resume remote audio after an autoplay block (must run from a user gesture). */
  resumeAudio(): Promise<void>;
  local(): LocalMedia;
  remotes(): RemoteParticipant[];
  connection(): ConnectionState;
  subscribe(listener: (e: CallEvent) => void): () => void;
  /** Stop every local track the SDK still holds (verification for REC-03 / CAP-03 style checks). */
  releaseLocalMedia(): void;
}

export type CallClientFactory = (authToken: string) => Promise<CallClient>;

/** Errors from creating/joining, mapped to explicit outcomes. Never carries the token. */
export type CallFailureCode = 'TOKEN_REJECTED' | 'NETWORK' | 'SDK_ERROR';

export class CallFailure extends Error {
  constructor(
    public readonly code: CallFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'CallFailure';
  }
}

/** Remove anything that looks like a JWT or bearer value from text shown or copied. */
export function redact(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '<redacted-token>')
    .replace(/(authToken|token|Bearer)([=:\s"]+)[^\s",}]+/gi, '$1$2<redacted>');
}

/** Classify an SDK init/join error without echoing token material. */
export function classifySdkError(e: unknown): CallFailure {
  const code = typeof e === 'object' && e !== null ? String((e as { code?: unknown }).code ?? '') : '';
  const message = e instanceof Error ? e.message : String(e);
  if (code === '0004' || /invalid auth token|jwt|expired/i.test(message)) {
    return new CallFailure('TOKEN_REJECTED', `Call authorization was rejected (${code || 'invalid token'}). Request a new authorization; the old one is not retried.`);
  }
  if (['0011', '0012'].includes(code) || /network|socket|fetch/i.test(message)) {
    return new CallFailure('NETWORK', `Could not reach the call service (${code || 'network'}): ${redact(message)}`);
  }
  return new CallFailure('SDK_ERROR', `Call SDK error${code ? ` ${code}` : ''}: ${redact(message)}`);
}
