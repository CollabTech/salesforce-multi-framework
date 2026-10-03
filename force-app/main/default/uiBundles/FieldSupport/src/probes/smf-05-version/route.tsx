import type { ProbeRoute } from '@/probes/registry';
import PackageVersionPage from './PackageVersionPage';

export const probeRoute: ProbeRoute = {
  path: 'probes/package-version',
  label: 'Package version marker',
  story: 'SMF-5',
  caseIds: ['PKG-01', 'PKG-02'],
  element: <PackageVersionPage />,
};
