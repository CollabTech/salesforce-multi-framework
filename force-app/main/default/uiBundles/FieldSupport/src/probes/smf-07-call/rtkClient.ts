import type RealtimeKitClient from '@cloudflare/realtimekit';
import { classifySdkError, type CallClient, type CallEvent, type ConnectionState, type RemoteParticipant } from './callClient';

type Meeting = Awaited<ReturnType<typeof RealtimeKitClient.init>>;
type SdkParticipant = Meeting['participants']['joined'] extends ReadonlyMap<string, infer P> ? P : never;

function toRemote(p: SdkParticipant): RemoteParticipant {
  return {
    id: p.id,
    name: p.name,
    audioEnabled: p.audioEnabled,
    videoEnabled: p.videoEnabled,
    audioTrack: p.audioTrack ?? undefined,
    videoTrack: p.videoTrack ?? undefined,
  };
}

/**
 * RealtimeKit (Cloudflare) implementation of CallClient using the Core SDK
 * (@cloudflare/realtimekit, pinned 2.0.2). The SDK is loaded lazily so the probe page and the
 * rest of the app do not pay for it until a call starts. The participant token is passed to
 * the SDK only; it is never stored, logged or rendered.
 */
export async function createRealtimeKitClient(authToken: string): Promise<CallClient> {
  let meeting: Meeting;
  try {
    const mod = await import('@cloudflare/realtimekit');
    meeting = await mod.default.init({ authToken, defaults: { audio: false, video: false } });
  } catch (e) {
    throw classifySdkError(e);
  }

  const listeners = new Set<(e: CallEvent) => void>();
  const emit = (e: CallEvent): void => listeners.forEach(l => l(e));
  const conn: ConnectionState = { socket: 'unknown', reconnectAttempt: 0, send: 'unknown', recv: 'unknown' };

  const readConn = (): ConnectionState => {
    const s = meeting.meta.socketState;
    const m = meeting.meta.mediaState;
    return {
      socket: s?.state ?? conn.socket,
      reconnectAttempt: s?.reconnectionAttempt ?? conn.reconnectAttempt,
      send: m?.send?.state ?? conn.send,
      recv: m?.recv?.state ?? conn.recv,
    };
  };

  meeting.meta.on('socketConnectionUpdate', s => {
    conn.socket = s.state;
    conn.reconnectAttempt = s.reconnectionAttempt;
    emit({ type: 'connection', state: { ...conn } });
  });
  meeting.meta.on('mediaConnectionUpdate', m => {
    if (m.transport === 'send') conn.send = m.state;
    else conn.recv = m.state;
    emit({ type: 'connection', state: { ...conn } });
  });
  const joined = meeting.participants.joined;
  for (const ev of ['participantJoined', 'participantLeft', 'audioUpdate', 'videoUpdate', 'participantsCleared'] as const) {
    joined.on(ev as 'participantJoined', () => emit({ type: 'remotes' }));
  }
  meeting.self.on('audioUpdate', () => emit({ type: 'local' }));
  meeting.self.on('videoUpdate', () => emit({ type: 'local' }));
  meeting.self.on('roomJoined', p => emit({ type: 'roomJoined', reconnected: p.reconnected }));
  meeting.self.on('roomLeft', p => emit({ type: 'roomLeft', state: String(p.state) }));
  meeting.self.on('autoplayError', () => emit({ type: 'autoplayBlocked' }));
  meeting.self.on('mediaPermissionError', p => emit({ type: 'mediaPermissionError', kind: p.kind, message: String(p.message) }));

  return {
    selfId: () => meeting.self.id,
    async join() {
      try {
        await meeting.join();
      } catch (e) {
        throw classifySdkError(e);
      }
    },
    async leave() {
      await meeting.leave();
    },
    async setMic(on) {
      if (on) await meeting.self.enableAudio();
      else await meeting.self.disableAudio();
    },
    async setCamera(on, track) {
      if (on) await meeting.self.enableVideo(track);
      else await meeting.self.disableVideo();
    },
    resumeAudio: () => meeting.self.playAudio(),
    local: () => ({
      audioEnabled: meeting.self.audioEnabled,
      videoEnabled: meeting.self.videoEnabled,
      audioTrack: meeting.self.audioTrack ?? undefined,
      videoTrack: meeting.self.videoTrack ?? undefined,
    }),
    remotes: () => Array.from(joined.values()).map(toRemote),
    connection: readConn,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    releaseLocalMedia() {
      meeting.self.audioTrack?.stop();
      meeting.self.videoTrack?.stop();
      meeting.self.cleanUpTracks();
    },
  };
}
