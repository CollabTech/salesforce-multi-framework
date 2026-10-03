import { CallFailure, classifySdkError, redact, type CallClient, type CallClientFactory, type ConnectionState, type LocalMedia, type RemoteParticipant } from './callClient';
import type { TokenResult } from './callApi';

/**
 * SMF-7 call session state machine (pure TypeScript, unit-tested with a fake client).
 *   idle → authorizing → (denied | connecting) → joined → leaving → left
 *   any → failed (token rejected / network / SDK)
 * Invalid or expired authorization is never retried automatically and the token is never
 * shown, logged or copied (CALL-03).
 */

export type Phase = 'idle' | 'authorizing' | 'denied' | 'connecting' | 'joined' | 'leaving' | 'left' | 'failed';

export interface LogEntry {
  at: string;
  message: string;
}

export interface SessionState {
  phase: Phase;
  denial: { status: number; code: string; message: string } | null;
  failure: { code: string; message: string } | null;
  displayName: string;
  joinedAt: number | null;
  mic: boolean;
  camera: boolean;
  remotes: RemoteParticipant[];
  connection: ConnectionState;
  autoplayBlocked: boolean;
  hasLastToken: boolean;
  lastLeave: { at: string; tracks: string[]; allEnded: boolean } | null;
  log: LogEntry[];
}

export interface SessionDeps {
  requestToken(caseId: string): Promise<TokenResult>;
  createClient: CallClientFactory;
  now?: () => Date;
}

const INITIAL_CONN: ConnectionState = { socket: 'none', reconnectAttempt: 0, send: 'none', recv: 'none' };
/** Well-formed but unsigned/invalid JWT used as the invalid-authorization negative control. */
export const INVALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.aW52YWxpZC1zaWduYXR1cmU'; // header.{}."invalid-signature"

/** Change the signature segment of a JWT so the provider must reject it. */
export function tamperToken(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[2].length < 4) return INVALID_TOKEN;
  const sig = parts[2];
  const flipped = sig.slice(0, -4) + (sig.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  return `${parts[0]}.${parts[1]}.${flipped}`;
}

export class CallSession {
  private client: CallClient | null = null;
  private unsub: (() => void) | null = null;
  private lastToken: string | null = null;
  private listeners = new Set<(s: SessionState) => void>();
  private s: SessionState = {
    phase: 'idle',
    denial: null,
    failure: null,
    displayName: '',
    joinedAt: null,
    mic: false,
    camera: false,
    remotes: [],
    connection: { ...INITIAL_CONN },
    autoplayBlocked: false,
    hasLastToken: false,
    lastLeave: null,
    log: [],
  };

  constructor(private readonly deps: SessionDeps) {}

  get state(): SessionState {
    return this.s;
  }

  /** Local media of the current client (tracks are not part of the serializable state). */
  localMedia(): LocalMedia | null {
    return this.client ? this.client.local() : null;
  }

  subscribe(l: (s: SessionState) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private set(patch: Partial<SessionState>): void {
    this.s = { ...this.s, ...patch };
    this.listeners.forEach(l => l(this.s));
  }

  log(message: string): void {
    this.set({ log: [...this.s.log, { at: this.now().toISOString(), message: redact(message) }].slice(-200) });
  }

  /** Authorize against the Case (server boundary), then join with the returned token. */
  async authorizeAndJoin(caseId: string): Promise<void> {
    if (this.s.phase === 'authorizing' || this.s.phase === 'connecting' || this.s.phase === 'joined') return;
    this.set({ phase: 'authorizing', denial: null, failure: null });
    this.log('requesting call authorization for the case');
    const t0 = this.now().getTime();
    const r = await this.deps.requestToken(caseId);
    if (!r.ok) {
      this.set({ phase: 'denied', denial: { status: r.status, code: r.code, message: r.message } });
      this.log(`authorization DENIED: HTTP ${r.status} ${r.code} (${this.now().getTime() - t0} ms)`);
      return;
    }
    this.lastToken = r.authToken;
    this.set({ displayName: r.displayName, hasLastToken: true });
    this.log(`authorization granted (${this.now().getTime() - t0} ms)`);
    await this.connect(r.authToken, 'authorized token');
  }

  /** Rejoin with the previously issued token, without a new authorization (expired/revoked control, REC-03). */
  async rejoinWithLastToken(): Promise<void> {
    if (!this.lastToken) {
      this.log('no previous token in memory');
      return;
    }
    await this.connect(this.lastToken, 'previous token (no new authorization)');
  }

  /** Negative controls: a malformed token, or the last token with an altered signature. */
  async joinWithInvalidToken(kind: 'invalid' | 'tampered'): Promise<void> {
    const token = kind === 'tampered' && this.lastToken ? tamperToken(this.lastToken) : INVALID_TOKEN;
    await this.connect(token, kind === 'tampered' && this.lastToken ? 'tampered token' : 'invalid token');
  }

  private async connect(token: string, label: string): Promise<void> {
    if (this.client) await this.leave();
    this.set({ phase: 'connecting', failure: null, denial: null });
    const t0 = this.now().getTime();
    try {
      const client = await this.deps.createClient(token);
      this.client = client;
      this.unsub = client.subscribe(e => {
        switch (e.type) {
          case 'remotes':
            this.set({ remotes: client.remotes() });
            break;
          case 'local':
            this.set({ mic: client.local().audioEnabled, camera: client.local().videoEnabled });
            break;
          case 'connection':
            this.set({ connection: e.state });
            this.log(`connection: socket=${e.state.socket} attempt=${e.state.reconnectAttempt} send=${e.state.send} recv=${e.state.recv}`);
            break;
          case 'roomJoined':
            this.log(`room joined${e.reconnected ? ' (reconnected)' : ''}`);
            break;
          case 'roomLeft':
            this.log(`room left: ${e.state}`);
            if (this.s.phase === 'joined') this.set({ phase: e.state === 'left' ? 'left' : 'failed', failure: e.state === 'left' ? null : { code: 'ROOM_LEFT', message: e.state } });
            break;
          case 'autoplayBlocked':
            this.set({ autoplayBlocked: true });
            this.log('remote audio autoplay was blocked by the host; tap "Enable remote audio"');
            break;
          case 'mediaPermissionError':
            this.log(`media permission error (${e.kind}): ${e.message}`);
            break;
        }
      });
      await client.join();
      this.set({ phase: 'joined', joinedAt: this.now().getTime(), remotes: client.remotes(), connection: client.connection() });
      this.log(`joined with ${label} in ${this.now().getTime() - t0} ms`);
    } catch (e) {
      const f = e instanceof CallFailure ? e : classifySdkError(e);
      if (f.code === 'TOKEN_REJECTED' && label.startsWith('previous')) this.lastToken = null;
      this.cleanupClient();
      this.set({ phase: 'failed', failure: { code: f.code, message: f.message }, hasLastToken: this.lastToken !== null });
      this.log(`join FAILED with ${label}: ${f.code} — no automatic retry`);
    }
  }

  async setMic(on: boolean): Promise<void> {
    if (!this.client) return;
    await this.client.setMic(on);
    this.set({ mic: this.client.local().audioEnabled });
    this.log(`mic ${on ? 'on' : 'off'} → sending audio: ${this.client.local().audioEnabled}`);
  }

  async setCamera(on: boolean, track?: MediaStreamTrack): Promise<void> {
    if (!this.client) return;
    await this.client.setCamera(on, track);
    this.set({ camera: this.client.local().videoEnabled });
    this.log(`camera ${on ? 'on' : 'off'}${track ? ' (marker composite)' : ''} → sending video: ${this.client.local().videoEnabled}`);
  }

  async resumeAudio(): Promise<void> {
    await this.client?.resumeAudio();
    this.set({ autoplayBlocked: false });
    this.log('remote audio playback resumed from a user gesture');
  }

  /** Leave the room and stop every local track; records what ended. */
  async leave(): Promise<void> {
    const client = this.client;
    if (!client) return;
    this.set({ phase: 'leaving' });
    const local = client.local();
    const tracks = [local.audioTrack, local.videoTrack].filter((t): t is MediaStreamTrack => !!t);
    try {
      await client.leave();
    } catch (e) {
      this.log(`leave error: ${e instanceof Error ? e.message : String(e)}`);
    }
    client.releaseLocalMedia();
    this.cleanupClient();
    const states = tracks.map(t => `${t.kind}:${t.readyState}`);
    const rec = { at: this.now().toISOString(), tracks: states, allEnded: tracks.every(t => t.readyState === 'ended') };
    this.set({ phase: 'left', remotes: [], mic: false, camera: false, lastLeave: rec, connection: { ...INITIAL_CONN } });
    this.log(`left: local tracks ${states.join(', ') || 'none'}; all ended=${rec.allEnded}`);
  }

  private cleanupClient(): void {
    this.unsub?.();
    this.unsub = null;
    this.client = null;
  }
}
