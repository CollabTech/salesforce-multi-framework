import { FALLBACK, fixtureById } from './fixtures';

interface StaticFallbackProps {
  reason: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Accessible static equipment image + text part list shown whenever the 3D view is not usable. */
export function StaticFallback({ reason, onRetry, retryLabel = 'Retry 3D view' }: StaticFallbackProps) {
  const parts = fixtureById('MF-MODEL-SMALL')?.parts ?? [];
  return (
    <section aria-label="Static equipment view" data-testid="static-fallback" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p role="status" className="text-sm font-semibold text-amber-900">
        Showing the static equipment image: {reason}
      </p>
      <img src={FALLBACK.url} alt={FALLBACK.alt} width={FALLBACK.width} height={FALLBACK.height} className="mt-2 h-auto w-full max-w-xl rounded border border-slate-200 bg-white" />
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Parts shown ({parts.length})</summary>
        <ul className="list-disc pl-5">
          {parts.map(p => (
            <li key={p.partId}>
              {p.label} <span className="text-xs text-slate-500">({p.partId})</span>
            </li>
          ))}
        </ul>
      </details>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-md border border-amber-400 bg-white px-4 text-sm font-medium hover:bg-amber-100">
          {retryLabel}
        </button>
      )}
    </section>
  );
}
