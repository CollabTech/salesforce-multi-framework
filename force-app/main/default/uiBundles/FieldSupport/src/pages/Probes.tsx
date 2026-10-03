import { Link } from 'react-router';
import { probes } from '@/probes/registry';

export default function ProbesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Capability probes</h1>
      {probes.length === 0 && <p className="mt-4">No probes are installed in this build.</p>}
      <ul className="mt-4 space-y-2">
        {probes.map(p => (
          <li key={p.path}>
            <Link to={`/${p.path}`} className="inline-flex min-h-11 items-center underline">
              {p.story} · {p.label}
            </Link>{' '}
            <span className="text-xs text-slate-500">{p.caseIds.join(', ')}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
