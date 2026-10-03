import { lazy, Suspense } from 'react';
import type { ProbeRoute } from '../registry';

// Lazy so three.js (~0.6 MB) loads only when this probe is opened, not with the launch app.
const Probe3DPage = lazy(() => import('./Probe3DPage'));

export const probeRoute: ProbeRoute = {
  path: 'probes/3d',
  label: 'Interactive 3D equipment',
  story: 'SMF-13',
  caseIds: ['3D-01', '3D-02', '3D-03'],
  element: (
    <Suspense fallback={<p className="p-6">Loading the 3D probe…</p>}>
      <Probe3DPage />
    </Suspense>
  ),
};
