import { lazy, Suspense } from 'react';
import type { ProbeRoute } from '../registry';

const BudgetProbePage = lazy(() => import('./BudgetProbePage'));

export const probeRoute: ProbeRoute = {
  path: 'probes/3d-budget',
  label: '3D delivery and budget',
  story: 'SMF-14',
  caseIds: ['BUDGET-01', 'BUDGET-02', 'BUDGET-03', 'BUDGET-04'],
  element: (
    <Suspense fallback={<p className="p-6">Loading the 3D budget probe…</p>}>
      <BudgetProbePage />
    </Suspense>
  ),
};
