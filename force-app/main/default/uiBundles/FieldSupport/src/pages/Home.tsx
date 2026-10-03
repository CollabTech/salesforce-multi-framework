import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchCurrentUser, type CurrentUser } from '@/features/launch/currentUser';
import { formatHostContext, readHostContext } from '@/features/launch/hostContext';

type Load = { state: 'loading' } | { state: 'ok'; user: CurrentUser | null } | { state: 'error'; message: string };

/** SMF-4 launch check: authenticated context + host details for HOST-01..03 evidence. */
export default function HomePage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [copied, setCopied] = useState(false);
  const ctx = useMemo(() => readHostContext(), []);

  useEffect(() => {
    document.title = 'Launch check | Field Support PoC';
    fetchCurrentUser()
      .then(user => setLoad({ state: 'ok', user }))
      .catch((e: unknown) => setLoad({ state: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);

  const userName = load.state === 'ok' ? (load.user?.name ?? null) : null;
  const report = formatHostContext(ctx, userName);

  const copy = (): void => {
    void navigator.clipboard?.writeText(report).then(() => setCopied(true));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-4 · HOST-01..03</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Launch check</h1>
      <Card className="mt-6" data-testid="auth-context">
        <CardHeader>
          <CardTitle>Authenticated context</CardTitle>
        </CardHeader>
        <CardContent>
          {load.state === 'loading' && <p>Reading the signed-in Salesforce user…</p>}
          {load.state === 'ok' && (
            <p>
              Signed in as <strong data-testid="user-name">{userName ?? '(no name returned)'}</strong>
            </p>
          )}
          {load.state === 'error' && (
            <p role="alert" className="text-red-700">
              Could not read the Salesforce user: {load.message}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Host details to record</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs" data-testid="host-context">
            {report}
          </pre>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button className="min-h-11" onClick={copy}>
              {copied ? 'Copied' : 'Copy for evidence'}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/launch/navigation">Navigation check</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/probes">Capability probes</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
