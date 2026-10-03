import type { ProbeRoute } from '../registry';
import FilesProbe from './FilesProbe';

export const probeRoute: ProbeRoute = {
  path: 'probes/files',
  label: 'Case image in Salesforce Files',
  story: 'SMF-10',
  caseIds: ['FILE-01', 'FILE-02', 'FILE-03', 'FILE-04'],
  element: <FilesProbe />,
};
