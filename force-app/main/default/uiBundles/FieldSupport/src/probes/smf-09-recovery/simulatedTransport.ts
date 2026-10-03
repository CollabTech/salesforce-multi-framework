import type { CallClient, CallEvent, ConnectionState, LocalMedia, RemoteParticipant } from '../smf-07-call/callClient';

/**
 * SIMULATED transport for exercising the SMF-9 recovery logic without a call service.
 * It reacts to the browser's online/offline events the way a signaling + media client would
 * (disconnect on offline; reconnecting → connected after online). It is labelled everywhere
 * in the UI and never counts as evidence of RealtimeKit or Salesforce behaviour.
 */
export const SIMULATED_RECONNECT_MS = { reconnecting: 800, connected: 1500 };

export function createSimulatedClient(): CallClient & { addDuplicateRemote(): void } {
  const listeners = new Set<(e: CallEvent) => void>();
  const emit = (e: CallEvent): void => listeners.forEach(l => l(e));
  let conn: ConnectionState = { socket: 'none', reconnectAttempt: 0, send: 'none', recv: 'none' };
  let remotes: RemoteParticipant[] = [];
  let local: LocalMedia = { audioEnabled: false, videoEnabled: false };
  const timers: number[] = [];
  let joined = false;

  const setConn = (c: Partial<ConnectionState>): void => {
    conn = { ...conn, ...c };
    emit({ type: 'connection', state: { ...conn } });
  };
  const onOffline = (): void => {
    if (!joined) return;
    setConn({ socket: 'disconnected', send: 'disconnected', recv: 'disconnected' });
    remotes = [];
    emit({ type: 'remotes' });
  };
  const onOnline = (): void => {
    if (!joined) return;
    timers.push(window.setTimeout(() => setConn({ socket: 'reconnecting', reconnectAttempt: conn.reconnectAttempt + 1 }), SIMULATED_RECONNECT_MS.reconnecting));
    timers.push(
      window.setTimeout(() => {
        setConn({ socket: 'connected', send: 'connected', recv: 'connected' });
        remotes = [{ id: 'sim-remote-1', name: 'Simulated SUPPORT', audioEnabled: true, videoEnabled: true }];
        emit({ type: 'remotes' });
        emit({ type: 'roomJoined', reconnected: true });
      }, SIMULATED_RECONNECT_MS.connected),
    );
  };

  const canvasTrack = (): MediaStreamTrack => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    c.getContext('2d')?.fillRect(0, 0, 160, 90);
    return c.captureStream(5).getVideoTracks()[0];
  };

  return {
    selfId: () => 'sim-self',
    async join() {
      joined = true;
      window.addEventListener('offline', onOffline);
      window.addEventListener('online', onOnline);
      setConn({ socket: 'connected', send: 'connected', recv: 'connected' });
      remotes = [{ id: 'sim-remote-1', name: 'Simulated SUPPORT', audioEnabled: true, videoEnabled: true }];
      emit({ type: 'remotes' });
      emit({ type: 'roomJoined', reconnected: false });
    },
    async leave() {
      joined = false;
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      timers.forEach(t => window.clearTimeout(t));
      remotes = [];
      setConn({ socket: 'none', send: 'none', recv: 'none' });
      emit({ type: 'roomLeft', state: 'left' });
    },
    async setMic(on) {
      local = { ...local, audioEnabled: on };
      emit({ type: 'local' });
    },
    async setCamera(on, track) {
      if (!on) local.videoTrack?.stop();
      local = { ...local, videoEnabled: on, videoTrack: on ? (track ?? canvasTrack()) : local.videoTrack };
      emit({ type: 'local' });
    },
    async resumeAudio() {
      /* nothing to resume in simulation */
    },
    local: () => local,
    remotes: () => remotes,
    connection: () => conn,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    releaseLocalMedia() {
      local.videoTrack?.stop();
      local.audioTrack?.stop();
    },
    addDuplicateRemote() {
      remotes = [...remotes, { id: `sim-remote-${remotes.length + 1}`, name: 'Simulated SUPPORT', audioEnabled: true, videoEnabled: true }];
      emit({ type: 'remotes' });
    },
  };
}
