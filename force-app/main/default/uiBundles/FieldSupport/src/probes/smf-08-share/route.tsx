import type { ProbeRoute } from '../registry';
import CallProbe from '../smf-07-call/CallProbe';
import { SharePanel } from './SharePanel';

export const probeRoute: ProbeRoute = {
  path: 'probes/share',
  label: 'Screen share in the call',
  story: 'SMF-8',
  caseIds: ['SHARE-01', 'SHARE-02', 'SHARE-03'],
  element: <CallProbe tag="SMF-8 · SHARE-01..03 (in the SMF-7 call)" heading="Screen share during the call" Extension={SharePanel} />,
};
