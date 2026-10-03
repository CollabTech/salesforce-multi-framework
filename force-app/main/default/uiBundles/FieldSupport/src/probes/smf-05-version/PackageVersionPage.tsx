import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PACKAGE_MARKER, formatPackageMarker } from './packageVersion';

/** SMF-5 PKG-01/PKG-02: shows which package version's bundle is being served. */
export default function PackageVersionPage() {
  const [copied, setCopied] = useState(false);
  const report = useMemo(
    () => formatPackageMarker(PACKAGE_MARKER, import.meta.env.VITE_BUILD_COMMIT ?? 'local', new Date().toISOString()),
    []
  );

  useEffect(() => {
    document.title = 'Package version | Field Support PoC';
  }, []);

  const copy = (): void => {
    void navigator.clipboard?.writeText(report).then(() => setCopied(true));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-5 · PKG-01..03</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Package version</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Installed bundle marker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-slate-900" data-testid="package-marker">
            {PACKAGE_MARKER.label}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Expected package version <span data-testid="package-number">{PACKAGE_MARKER.number}</span>
          </p>
          <pre className="mt-4 whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="package-report">
            {report}
          </pre>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button className="min-h-11" onClick={copy}>
              {copied ? 'Copied' : 'Copy for evidence'}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/">Back to launch check</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
