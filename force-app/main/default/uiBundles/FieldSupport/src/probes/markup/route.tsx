import { lazy, Suspense } from 'react';
import type { ProbeRoute } from '../registry';

// tldraw is large: load it only when this probe opens.
const MarkupProbe = lazy(() => import('./MarkupProbe'));

export const probeRoute: ProbeRoute = {
  path: 'probes/markup',
  label: 'Equipment markup in Salesforce Files',
  story: 'SMF-11',
  caseIds: ['MARK-01', 'MARK-02', 'MARK-03', 'MARK-04'],
  element: (
    <Suspense fallback={<p className="p-6">Loading markup editor…</p>}>
      <MarkupProbe />
    </Suspense>
  ),
};
