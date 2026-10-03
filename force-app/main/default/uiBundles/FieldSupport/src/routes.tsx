import type { RouteObject } from 'react-router';
import AppLayout from './appLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import NavigationCheck from './pages/NavigationCheck';
import ProbesPage from './pages/Probes';
import { probeRoutes } from './probes/registry';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home />, handle: { showInNavigation: true, label: 'Launch check' } },
      { path: 'launch/navigation', element: <NavigationCheck />, handle: { showInNavigation: true, label: 'Navigation check' } },
      { path: 'probes', element: <ProbesPage />, handle: { showInNavigation: true, label: 'Probes' } },
      ...probeRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
];
