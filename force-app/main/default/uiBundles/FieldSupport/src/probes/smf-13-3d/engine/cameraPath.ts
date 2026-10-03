/**
 * Scripted, time-based camera path for the repeatable 60 s interaction (3D-02, BUDGET-01).
 * Pose depends only on elapsed time, so every run on every host visits the same views
 * regardless of frame rate. Distances are multiples of the model's framing distance.
 *
 *   0–20 s  full 360° orbit at 25° elevation
 *  20–35 s  zoom in to 0.55x and back out while orbiting slowly
 *  35–50 s  elevation sweep 10°→70°→10° while orbiting
 *  50–60 s  part-selection phase: one part selected per second, camera holds a 3/4 view
 */
export const PROTOCOL_DURATION_MS = 60_000;

export interface CameraPose {
  /** Azimuth around the vertical axis, radians. */
  azimuth: number;
  /** Elevation above the horizontal plane, radians. */
  elevation: number;
  /** Distance as a multiple of the framing distance. */
  distanceScale: number;
  /** Index of the part to select in the selection phase, or null. */
  selectIndex: number | null;
  phase: 'orbit' | 'zoom' | 'elevation' | 'select' | 'done';
}

const DEG = Math.PI / 180;
const HOME_AZIMUTH = -40 * DEG;

export function poseAt(elapsedMs: number, partCount: number): CameraPose {
  const t = Math.max(0, elapsedMs) / 1000;
  if (t < 20) {
    return { azimuth: HOME_AZIMUTH + (t / 20) * 2 * Math.PI, elevation: 25 * DEG, distanceScale: 1, selectIndex: null, phase: 'orbit' };
  }
  if (t < 35) {
    const u = (t - 20) / 15; // 0..1
    return {
      azimuth: HOME_AZIMUTH + u * 0.5 * Math.PI,
      elevation: 25 * DEG,
      distanceScale: 1 - 0.45 * Math.sin(u * Math.PI),
      selectIndex: null,
      phase: 'zoom',
    };
  }
  if (t < 50) {
    const u = (t - 35) / 15;
    return {
      azimuth: HOME_AZIMUTH + 0.5 * Math.PI + u * 0.5 * Math.PI,
      elevation: (10 + 60 * Math.sin(u * Math.PI)) * DEG,
      distanceScale: 1,
      selectIndex: null,
      phase: 'elevation',
    };
  }
  if (t < 60) {
    const idx = partCount > 0 ? Math.floor(t - 50) % partCount : null;
    return { azimuth: HOME_AZIMUTH + Math.PI, elevation: 25 * DEG, distanceScale: 0.9, selectIndex: idx, phase: 'select' };
  }
  return { azimuth: HOME_AZIMUTH, elevation: 25 * DEG, distanceScale: 1, selectIndex: null, phase: 'done' };
}

/** Converts a pose to a camera offset from the orbit target. */
export function poseToOffset(pose: CameraPose, framingDistance: number): [number, number, number] {
  const r = framingDistance * pose.distanceScale;
  const h = Math.cos(pose.elevation) * r;
  return [Math.sin(pose.azimuth) * h * -1, Math.sin(pose.elevation) * r, Math.cos(pose.azimuth) * h];
}

/** The default "home" pose used by reset and initial framing. */
export const HOME_POSE: CameraPose = { azimuth: HOME_AZIMUTH, elevation: 25 * DEG, distanceScale: 1, selectIndex: null, phase: 'done' };
