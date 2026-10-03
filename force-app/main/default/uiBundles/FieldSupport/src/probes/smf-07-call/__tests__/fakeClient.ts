import { CallFailure, type CallClient, type CallEvent, type ConnectionState, type LocalMedia, type RemoteParticipant } from '../callClient';

/** In-memory CallClient for unit tests (no network, no SDK). Not evidence of any call. */
export class FakeTrack {
  readyState: MediaStreamTrackState = 'live';
  constructor(public kind: string) {}
  stop(): void {
    this.readyState = 'ended';
  }
}

export class FakeClient implements CallClient {
  listeners = new Set<(e: CallEvent) => void>();
  joined = false;
  localMedia: LocalMedia = { audioEnabled: false, videoEnabled: false };
  remoteList: RemoteParticipant[] = [];
  conn: ConnectionState = { socket: 'connected', reconnectAttempt: 0, send: 'connected', recv: 'connected' };
  calls: string[] = [];
  constructor(public token: string) {}
  selfId = (): string => 'self-1';
  async join(): Promise<void> {
    this.calls.push('join');
    this.joined = true;
    this.emit({ type: 'roomJoined', reconnected: false });
  }
  async leave(): Promise<void> {
    this.calls.push('leave');
    this.joined = false;
  }
  async setMic(on: boolean): Promise<void> {
    this.localMedia = { ...this.localMedia, audioEnabled: on, audioTrack: (on ? new FakeTrack('audio') : this.localMedia.audioTrack) as unknown as MediaStreamTrack };
  }
  async setCamera(on: boolean, track?: MediaStreamTrack): Promise<void> {
    this.localMedia = { ...this.localMedia, videoEnabled: on, videoTrack: on ? (track ?? (new FakeTrack('video') as unknown as MediaStreamTrack)) : this.localMedia.videoTrack };
  }
  async resumeAudio(): Promise<void> {
    this.calls.push('resumeAudio');
  }
  local = (): LocalMedia => this.localMedia;
  remotes = (): RemoteParticipant[] => this.remoteList;
  connection = (): ConnectionState => this.conn;
  subscribe(l: (e: CallEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  releaseLocalMedia(): void {
    this.localMedia.audioTrack?.stop();
    this.localMedia.videoTrack?.stop();
  }
  emit(e: CallEvent): void {
    this.listeners.forEach(l => l(e));
  }
}

/** Factory that rejects tokens not in the allow-list, like the provider does. */
export function fakeFactory(valid: Set<string>, created: FakeClient[] = []) {
  return async (token: string): Promise<FakeClient> => {
    if (!valid.has(token)) throw new CallFailure('TOKEN_REJECTED', 'Call authorization was rejected (0004).');
    const c = new FakeClient(token);
    created.push(c);
    return c;
  };
}
