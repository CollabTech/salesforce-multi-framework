import type { ProbeRoute } from '../registry';
import CallProbe from './CallProbe';

export const probeRoute: ProbeRoute = {
  path: 'probes/call',
  label: 'Two-person call (RealtimeKit)',
  story: 'SMF-7',
  caseIds: ['CALL-01', 'CALL-02', 'CALL-03'],
  element: <CallProbe />,
};
