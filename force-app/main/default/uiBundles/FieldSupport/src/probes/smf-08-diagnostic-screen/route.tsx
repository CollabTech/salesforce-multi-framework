import type { ProbeRoute } from '../registry';
import DiagnosticScreen from './DiagnosticScreen';

export const probeRoute: ProbeRoute = {
  path: 'probes/diagnostic-screen',
  label: 'Synthetic diagnostic screen (share this)',
  story: 'SMF-8',
  caseIds: ['SHARE-01', 'SHARE-02'],
  element: <DiagnosticScreen />,
};
