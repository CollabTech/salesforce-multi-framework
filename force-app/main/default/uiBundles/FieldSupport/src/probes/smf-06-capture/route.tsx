import type { ProbeRoute } from '../registry';
import CaptureProbe from './CaptureProbe';

export const probeRoute: ProbeRoute = {
  path: 'probes/capture',
  label: 'Camera and microphone capture',
  story: 'SMF-6',
  caseIds: ['CAP-01', 'CAP-02', 'CAP-03'],
  element: <CaptureProbe />,
};
