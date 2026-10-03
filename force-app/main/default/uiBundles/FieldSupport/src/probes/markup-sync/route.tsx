import { lazy, Suspense } from 'react';
import type { ProbeRoute } from '../registry';

const MarkupSyncProbe = lazy(() => import('./MarkupSyncProbe'));

export const probeRoute: ProbeRoute = {
  path: 'probes/markup-sync',
  label: 'Live two-user markup',
  story: 'SMF-12',
  caseIds: ['SYNC-01', 'SYNC-02', 'SYNC-03', 'SYNC-04'],
  element: (
    <Suspense fallback={<p className="p-6">Loading live markup…</p>}>
      <MarkupSyncProbe />
    </Suspense>
  ),
};
