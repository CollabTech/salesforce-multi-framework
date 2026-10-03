import { rmsLevel } from '../smf-06-capture/capture';
import { FRAME_H, FRAME_W, decodeMarker, drawMarker, markerValue } from './marker';

/**
 * Browser plumbing for the SMF-7 probe: outgoing video composited with the changing marker,
 * remote marker decoding, and audio level meters. Nothing is recorded or uploaded.
 */

export interface MarkerSource {
  track: MediaStreamTrack;
  value(): number;
  usingCamera: boolean;
  stop(): string[];
}

/**
 * Camera (or a synthetic scene when no camera is granted) + marker → canvas → video track.
 * `label` is a short role text (e.g. "TECH") drawn next to the counter.
 */
export async function createMarkerSource(label: string, useCamera: boolean): Promise<MarkerSource> {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  let camera: MediaStreamTrack | null = null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  if (useCamera) {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
    camera = s.getVideoTracks()[0];
    video.srcObject = new MediaStream([camera]);
    await video.play().catch(() => undefined);
  }
  const start = performance.now();
  let current = 0;
  const draw = (): void => {
    current = markerValue(performance.now(), start);
    if (camera && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H);
    } else {
      const g = ctx.createLinearGradient(0, 0, FRAME_W, FRAME_H);
      g.addColorStop(0, '#1e3a5f');
      g.addColorStop(1, '#6b7280');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '20px monospace';
      ctx.fillText('Synthetic scene · pump MF-PUMP-001 (MF-ASSET-001)', 24, FRAME_H / 2);
    }
    drawMarker(ctx, current, label);
  };
  draw();
  const timer = window.setInterval(draw, 66);
  const stream = canvas.captureStream(15);
  const track = stream.getVideoTracks()[0];
  return {
    track,
    value: () => current,
    usingCamera: camera !== null,
    stop: () => {
      window.clearInterval(timer);
      track.stop();
      camera?.stop();
      video.srcObject = null;
      return [`marker:${track.readyState}`, ...(camera ? [`camera:${camera.readyState}`] : [])];
    },
  };
}

/** Samples a <video> element: frames rendered and the decoded marker value. */
export class RemoteVideoProbe {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly seen: { at: number; value: number }[] = [];

  constructor() {
    this.canvas.width = FRAME_W;
    this.canvas.height = FRAME_H;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  sample(video: HTMLVideoElement | null): { frames: number; marker: number | null; distinctLast10s: number } {
    if (!video || !this.ctx || video.readyState < 2) return { frames: 0, marker: null, distinctLast10s: this.distinct() };
    const frames = typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality().totalVideoFrames : 0;
    this.ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H);
    const marker = decodeMarker(this.ctx.getImageData(0, 0, FRAME_W, FRAME_H).data);
    const now = performance.now();
    if (marker !== null) this.seen.push({ at: now, value: marker });
    while (this.seen.length && now - this.seen[0].at > 10_000) this.seen.shift();
    return { frames, marker, distinctLast10s: this.distinct() };
  }

  private distinct(): number {
    return new Set(this.seen.map(s => s.value)).size;
  }
}

/** RMS level of an audio track (local mic or remote audio). */
export class LevelMeter {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private trackId = '';

  read(track: MediaStreamTrack | undefined): number {
    if (!track || track.readyState !== 'live') {
      this.close();
      return 0;
    }
    if (track.id !== this.trackId) {
      this.close();
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return 0;
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.ctx.createMediaStreamSource(new MediaStream([track])).connect(this.analyser);
      void this.ctx.resume().catch(() => undefined);
      this.trackId = track.id;
    }
    if (!this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    return rmsLevel(buf);
  }

  close(): void {
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    this.ctx = null;
    this.analyser = null;
    this.trackId = '';
  }
}
