import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import CallProbe from '../smf-07-call/CallProbe';
import { CallSession, type SessionState } from '../smf-07-call/callSession';
import { RecoveryPanel } from './RecoveryPanel';
import { createSimulatedClient } from './simulatedTransport';

type SimClient = ReturnType<typeof createSimulatedClient>;

/** Clearly labelled simulation of the transport, for exercising the recovery logic only. */
function SimulatedCall() {
  const [sim] = useState(() => {
    const holder: { client: SimClient | null } = { client: null };
    const session = new CallSession({
      requestToken: async () => ({ ok: true, authToken: 'simulated', displayName: 'Simulated TECH' }),
      createClient: async () => {
        holder.client = createSimulatedClient();
        return holder.client;
      },
    });
    return { session, holder };
  });
  const session = sim.session;
  const [s, setS] = useState<SessionState>(session.state);
  useEffect(() => session.subscribe(setS), [session]);
  useEffect(() => () => void session.leave(), [session]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6" data-testid="smf9-simulated">
      <Alert variant="destructive">
        <AlertTitle>SIMULATED TRANSPORT — not a call, not evidence</AlertTitle>
        <AlertDescription>Reacts to the browser's offline/online events like a call client would. Use only to check the recovery panel's logic.</AlertDescription>
      </Alert>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Simulated session</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button className="min-h-11" disabled={s.phase === 'joined'} onClick={() => void session.authorizeAndJoin('simulated-case')} data-testid="sim-join">
            Join (simulated)
          </Button>
          <Button className="min-h-11" variant="outline" disabled={s.phase !== 'joined'} onClick={() => void session.setCamera(!s.camera)} data-testid="sim-camera">
            {s.camera ? 'Camera off' : 'Camera on'}
          </Button>
          <Button className="min-h-11" variant="outline" disabled={s.phase !== 'joined'} onClick={() => sim.holder.client?.addDuplicateRemote()} data-testid="sim-duplicate">
            Inject duplicate remote
          </Button>
          <Button className="min-h-11" variant="destructive" disabled={s.phase !== 'joined'} onClick={() => void session.leave()} data-testid="sim-leave">
            Leave
          </Button>
          <span className="self-center text-sm" data-testid="sim-phase">
            {s.phase}
          </span>
        </CardContent>
      </Card>
      <RecoveryPanel session={session} state={s} role="TECH" sendCustomVideo={async () => undefined} />
    </main>
  );
}

/** SMF-9 page: the real SMF-7 call with the recovery panel, or the labelled simulation. */
export default function RecoveryProbe() {
  const [mode, setMode] = useState<'call' | 'simulated'>('call');
  return (
    <div>
      <div className="mx-auto flex max-w-5xl flex-wrap gap-3 px-4 pt-6 sm:px-6">
        <Button className="min-h-11" variant={mode === 'call' ? 'default' : 'outline'} onClick={() => setMode('call')} data-testid="mode-call">
          Real call (RealtimeKit)
        </Button>
        <Button className="min-h-11" variant={mode === 'simulated' ? 'default' : 'outline'} onClick={() => setMode('simulated')} data-testid="mode-simulated">
          Simulated transport (logic check only)
        </Button>
      </div>
      {mode === 'call' ? <CallProbe tag="SMF-9 · REC-01..03 (in the SMF-7 call)" heading="Call recovery" Extension={RecoveryPanel} /> : <SimulatedCall />}
    </div>
  );
}
