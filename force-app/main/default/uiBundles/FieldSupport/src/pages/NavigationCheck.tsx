import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { fetchCurrentUser } from '@/features/launch/currentUser';

/** HOST-01: reached by in-app navigation, then reloaded; the user must still resolve. */
export default function NavigationCheck() {
  const [name, setName] = useState<string>('…');
  useEffect(() => {
    document.title = 'Navigation check | Field Support PoC';
    fetchCurrentUser()
      .then(u => setName(u?.name ?? '(none)'))
      .catch(() => setName('ERROR: user not resolved'));
  }, []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Navigation check</h1>
      <p className="mt-4">
        Route: <code data-testid="route">/launch/navigation</code>
      </p>
      <p className="mt-2">
        User after navigation/reload: <strong data-testid="nav-user">{name}</strong>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Reload this page (pull-to-refresh on mobile), then confirm the same user still shows.
      </p>
      <Button asChild variant="outline" className="mt-4 min-h-11">
        <Link to="/">Back to launch check</Link>
      </Button>
    </main>
  );
}
