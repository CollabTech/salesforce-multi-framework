import type { ProbeRoute } from '../registry';
import RecoveryProbe from './RecoveryProbe';

export const probeRoute: ProbeRoute = {
  path: 'probes/recovery',
  label: 'Call recovery',
  story: 'SMF-9',
  caseIds: ['REC-01', 'REC-02', 'REC-03'],
  element: <RecoveryProbe />,
};
