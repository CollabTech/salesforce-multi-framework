/**
 * Pure measurement helpers for SMF-13 3D-02 / SMF-14 BUDGET-01. Frame statistics are derived
 * from frame-to-frame intervals (ms) sampled in the render loop; fps figures are 1000 / interval.
 */

/** 3D-02 targets, fixed by the story (do not change without a recorded owner decision). */
export const TARGETS = Object.freeze({ usableWithinMs: 10_000, medianFpsAtLeast: 30 });

/** A frame interval above this is counted as a long frame (≈ below 20 fps for that frame). */
export const LONG_FRAME_MS = 50;

export interface FrameStats {
  frames: number;
  durationMs: number;
  meanFps: number;
  medianFps: number;
  /** 5th-percentile fps (the slow tail): 1000 / 95th-percentile frame time. */
  p5Fps: number;
  /** 95th-percentile fps: 1000 / 5th-percentile frame time. */
  p95Fps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number;
  longFrameThresholdMs: number;
}

/** Linear-interpolated percentile (p in [0, 100]) of an unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

const round = (v: number, d = 1): number => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : v);

export function frameStats(intervalsMs: readonly number[]): FrameStats {
  const valid = intervalsMs.filter(v => Number.isFinite(v) && v > 0);
  const durationMs = valid.reduce((s, v) => s + v, 0);
  const medianFrameMs = percentile(valid, 50);
  const p5FrameMs = percentile(valid, 5);
  const p95FrameMs = percentile(valid, 95);
  return {
    frames: valid.length,
    durationMs: round(durationMs, 0),
    meanFps: round(valid.length ? (valid.length * 1000) / durationMs : 0),
    medianFps: round(valid.length ? 1000 / medianFrameMs : 0),
    p5Fps: round(valid.length ? 1000 / p95FrameMs : 0),
    p95Fps: round(valid.length ? 1000 / p5FrameMs : 0),
    medianFrameMs: round(medianFrameMs, 2),
    p95FrameMs: round(p95FrameMs, 2),
    maxFrameMs: round(valid.length ? Math.max(...valid) : Number.NaN, 2),
    longFrames: valid.filter(v => v > LONG_FRAME_MS).length,
    longFrameThresholdMs: LONG_FRAME_MS,
  };
}

/** Load timing marks, all relative to the request start (ms). */
export interface LoadTimings {
  requestStartMs: 0;
  bytesReceivedMs: number;
  parsedMs: number;
  firstFrameMs: number;
  interactiveMs: number;
}

export function loadTimings(marks: { request: number; bytes: number; parsed: number; firstFrame: number; interactive: number }): LoadTimings {
  const r = (v: number): number => round(v - marks.request, 1);
  return { requestStartMs: 0, bytesReceivedMs: r(marks.bytes), parsedMs: r(marks.parsed), firstFrameMs: r(marks.firstFrame), interactiveMs: r(marks.interactive) };
}

export interface TargetJudgement {
  usableWithinTarget: boolean;
  medianFpsMeetsTarget: boolean;
  /** Text that states measured vs target, used verbatim in evidence. */
  summary: string;
}

/** Compares measured values with the fixed 3D-02 targets. Never adjusts the targets. */
export function judgeAgainstTargets(interactiveMs: number, stats: FrameStats): TargetJudgement {
  const usable = Number.isFinite(interactiveMs) && interactiveMs <= TARGETS.usableWithinMs;
  const fpsOk = stats.frames > 0 && stats.medianFps >= TARGETS.medianFpsAtLeast;
  return {
    usableWithinTarget: usable,
    medianFpsMeetsTarget: fpsOk,
    summary:
      `usable after ${round(interactiveMs, 0)} ms (target <= ${TARGETS.usableWithinMs} ms: ${usable ? 'met' : 'NOT met'}); ` +
      `median ${stats.medianFps} fps over ${stats.frames} frames / ${stats.durationMs} ms (target >= ${TARGETS.medianFpsAtLeast}: ${fpsOk ? 'met' : 'NOT met'}); ` +
      `p5 ${stats.p5Fps} fps, p95 ${stats.p95Fps} fps, ${stats.longFrames} long frames (> ${stats.longFrameThresholdMs} ms)`,
  };
}
