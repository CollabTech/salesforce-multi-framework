import type { RouteObject } from 'react-router';

/**
 * Probe routes are discovered from src/probes/<story-slug>/route.tsx so parallel story
 * branches never edit a shared routes file. Each module exports `probeRoute`.
 */
export interface ProbeRoute {
  path: string; // relative, e.g. "probes/capture"
  label: string;
  story: string; // e.g. "SMF-6"
  caseIds: string[];
  element: RouteObject['element'];
}

interface ProbeModule {
  probeRoute: ProbeRoute;
}

const modules = import.meta.glob<ProbeModule>('./*/route.tsx', { eager: true });

export const probes: ProbeRoute[] = Object.values(modules)
  .map(m => m.probeRoute)
  .sort((a, b) => Number(a.story.split('-')[1]) - Number(b.story.split('-')[1]));

export const probeRoutes: RouteObject[] = probes.map(p => ({
  path: p.path,
  element: p.element,
  handle: { showInNavigation: false, label: p.label },
}));
