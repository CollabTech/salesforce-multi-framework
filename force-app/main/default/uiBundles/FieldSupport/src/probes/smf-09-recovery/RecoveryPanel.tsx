import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import type { CallExtensionContext } from '../smf-07-call/CallProbe';
import { RecoveryTracker, SCENARIOS, episodesTable, hasDuplicates, variability, type Observation, type Scenario } from './recovery';

/**
 * SMF-9 panel: connection/participant state, interruption timeline with timestamps, automatic
 * disconnect detection and recovery timing, duplicate-participant detection, gesture-needed
 * flags, scenario/run labelling (3 runs each) and a copyable results table.
 */
export function RecoveryPanel({ session, state }: CallExtensionContext) {
  const tracker = useMemo(() => {
    const t = new RecoveryTracker();
    t.label('network-loss', 1);
    return t;
  }, []);
  const [, setTick] = useState(0);
  const [scenario, setScenario] = useState<Scenario>('network-loss');
  const [run, setRun] = useState(1);
  const [copied, setCopied] = useState(false);
  const last = useRef({ conn: '', remotes: '', phase: '', local: '' });

  useEffect(() => {
    const push = (o: Omit<Observation, 't'>): void => {
      tracker.add({ t: Date.now(), ...o });
      setTick(x => x + 1);
    };
    const handlers: [EventTarget, string, () => void][] = [
      [window, 'offline', () => push({ kind: 'browser-offline', detail: 'navigator.onLine=false' })],
      [window, 'online', () => push({ kind: 'browser-online', detail: 'navigator.onLine=true' })],
      [document, 'visibilitychange', () => push({ kind: document.visibilityState === 'hidden' ? 'hidden' : 'visible', detail: document.visibilityState })],
      [window, 'pagehide', () => push({ kind: 'pagehide', detail: 'pagehide' })],
      [window, 'pageshow', () => push({ kind: 'pageshow', detail: 'pageshow' })],
      [document, 'freeze', () => push({ kind: 'freeze', detail: 'page frozen' })],
      [document, 'resume', () => push({ kind: 'resume', detail: 'page resumed' })],
    ];
    handlers.forEach(([t, e, h]) => t.addEventListener(e, h));
    const unsub = session.subscribe(s => {
      const conn = `${s.connection.socket}/${s.connection.send}/${s.connection.recv}`;
      if (conn !== last.current.conn) {
        last.current.conn = conn;
        push({ kind: 'connection', detail: `socket=${s.connection.socket} attempt=${s.connection.reconnectAttempt} send=${s.connection.send} recv=${s.connection.recv}`, conn: { ...s.connection } });
      }
      const names = s.remotes.map(r => r.name);
      const remotes = names.join(',');
      if (remotes !== last.current.remotes) {
        last.current.remotes = remotes;
        push({ kind: 'remotes', detail: `${names.length} remote(s)${hasDuplicates(names) ? ' — DUPLICATE' : ''}`, remoteNames: names });
      }
      if (s.phase !== last.current.phase) {
        last.current.phase = s.phase;
        push({ kind: 'phase', detail: s.phase });
      }
    });
    const poll = window.setInterval(() => {
      const lm = session.localMedia();
      const desc = [lm?.audioTrack, lm?.videoTrack]
        .filter((t): t is MediaStreamTrack => !!t)
        .map(t => `${t.kind} ${t.readyState}${t.muted ? ' muted' : ''}`)
        .join(', ');
      if (desc !== last.current.local) {
        last.current.local = desc;
        if (desc) push({ kind: 'local-track', detail: desc });
      }
    }, 1000);
    return () => {
      handlers.forEach(([t, e, h]) => t.removeEventListener(e, h));
      unsub();
      window.clearInterval(poll);
    };
  }, [session, tracker]);

  const applyLabel = (s: Scenario, r: number): void => {
    setScenario(s);
    setRun(r);
    tracker.label(s, r);
  };

  const names = state.remotes.map(r => r.name);
  const duplicate = hasDuplicates(names);
  const table = episodesTable(tracker.episodes);
  const stats = SCENARIOS.map(s => ({ s, v: variability(tracker.episodes, s.id) })).filter(x => x.v.runs > 0);
  const timeline = tracker.observations.map(o => `${new Date(o.t).toISOString()} ${o.kind} ${o.detail}`).join('\n');
  const report = [`SMF-9 recovery log · build ${import.meta.env.VITE_BUILD_COMMIT ?? 'local'} · ${navigator.userAgent}`, '', table, '', 'Timeline:', timeline].join('\n');

  return (
    <Card className="mt-4" data-testid="recovery-panel">
      <CardHeader>
        <CardTitle>SMF-9 · Interruption and recovery (REC-01..03)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm" data-testid="recovery-state">
          Browser online={String(navigator.onLine)} · visibility={document.visibilityState} · socket={state.connection.socket} (attempt {state.connection.reconnectAttempt}) · send=
          {state.connection.send} · recv={state.connection.recv} · remotes={state.remotes.length} · phase={state.phase}
        </p>
        {duplicate && (
          <Alert variant="destructive" data-testid="duplicate-alert">
            <AlertTitle>Duplicate participant</AlertTitle>
            <AlertDescription>The same participant appears {names.length - new Set(names).size + 1} times: {names.join(', ')}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label>Scenario</Label>
            <Select value={scenario} onValueChange={v => applyLabel(v as Scenario, run)}>
              <SelectTrigger className="mt-1 min-h-11 w-full" data-testid="scenario-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            {[1, 2, 3].map(r => (
              <Button key={r} className="min-h-11" variant={run === r ? 'default' : 'outline'} onClick={() => applyLabel(scenario, r)} data-testid={`run-${r}`}>
                Run {r}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => {
              tracker.markStart(Date.now(), `${scenario} run ${run} started by tester`);
              setTick(x => x + 1);
            }}
            data-testid="mark-start"
          >
            Mark interruption start now
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => {
              tracker.closeUnrecovered(Date.now(), 'tester used manual recovery');
              setTick(x => x + 1);
            }}
            data-testid="close-unrecovered"
          >
            Automatic recovery failed — close episode
          </Button>
        </div>
        <p className="text-sm" data-testid="last-leave">
          Last leave: {state.lastLeave ? `${state.lastLeave.tracks.join(', ') || 'no local tracks'} · all ended=${state.lastLeave.allEnded}` : 'none yet'}
        </p>
        <div>
          <p className="text-sm font-medium">Episodes</p>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre rounded bg-slate-100 p-2 text-xs" data-testid="episodes">
            {table}
          </pre>
          <ul className="mt-1 text-xs" data-testid="variability">
            {stats.map(({ s, v }) => (
              <li key={s.id}>
                {s.label}: {v.recovered}/{v.runs} recovered · min {v.minMs ?? '—'} ms · median {v.medianMs ?? '—'} ms · max {v.maxMs ?? '—'} ms
              </li>
            ))}
          </ul>
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2 text-xs" data-testid="timeline">
          {timeline || 'No events yet.'}
        </pre>
        <Button className="min-h-11" onClick={() => void navigator.clipboard?.writeText(report).then(() => setCopied(true))}>
          {copied ? 'Copied' : 'Copy recovery log'}
        </Button>
      </CardContent>
    </Card>
  );
}
