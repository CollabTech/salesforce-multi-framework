/**
 * SMF-9 recovery tracker (pure, unit-tested). Consumes timestamped observations — browser
 * signals (online/offline, visibility, pagehide/pageshow, freeze/resume), SDK connection
 * states, remote participant lists, local track states — and derives interruption episodes:
 * when the interruption started, when the call detected it, when it recovered, how long it
 * took, whether A/V came back, whether a user gesture was needed, and duplicate participants.
 * It never decides PASS/FAIL; the tester compares the numbers with the case.
 */

export type Scenario =
  | 'network-loss'
  | 'network-switch'
  | 'background-foreground'
  | 'lock-unlock'
  | 'incoming-call'
  | 'leave-rejoin'
  | 'unlabelled';

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'network-loss', label: 'Network loss / recovery' },
  { id: 'network-switch', label: 'Network switch Wi-Fi ↔ cellular' },
  { id: 'background-foreground', label: 'App background / foreground' },
  { id: 'lock-unlock', label: 'Screen lock / unlock' },
  { id: 'incoming-call', label: 'Incoming phone call' },
  { id: 'leave-rejoin', label: 'Explicit leave / rejoin' },
];

export interface ConnSnapshot {
  socket: string;
  send: string;
  recv: string;
}

export interface Observation {
  t: number; // epoch ms
  kind:
    | 'browser-offline'
    | 'browser-online'
    | 'hidden'
    | 'visible'
    | 'pagehide'
    | 'pageshow'
    | 'freeze'
    | 'resume'
    | 'connection'
    | 'remotes'
    | 'local-track'
    | 'phase'
    | 'mark';
  detail: string;
  conn?: ConnSnapshot;
  remoteNames?: string[];
}

export interface Episode {
  scenario: Scenario;
  run: number;
  startedAt: number; // first interruption signal (browser or SDK)
  detectedAt: number | null; // first SDK-level disconnect signal
  recoveredAt: number | null; // socket connected and both transports connected again
  recoveryMs: number | null;
  detectMs: number | null;
  maxRemotes: number;
  duplicateRemotes: boolean;
  gestureNeeded: boolean;
  notes: string[];
}

const HEALTHY = (c: ConnSnapshot): boolean => c.socket === 'connected' && c.send === 'connected' && c.recv === 'connected';
const SDK_DOWN = (c: ConnSnapshot): boolean =>
  ['disconnected', 'reconnecting', 'failed'].includes(c.socket) || ['disconnected', 'failed', 'closed'].includes(c.send) || ['disconnected', 'failed', 'closed'].includes(c.recv);

/** True when the same display name appears more than once among remotes (duplicate participant). */
export function hasDuplicates(names: string[]): boolean {
  return new Set(names).size !== names.length;
}

export class RecoveryTracker {
  readonly observations: Observation[] = [];
  readonly episodes: Episode[] = [];
  private open: Episode | null = null;
  /** Last recovered episode; remote lists within 10 s after recovery still count (duplicates appear on rejoin). */
  private recent: { e: Episode; until: number } | null = null;
  private conn: ConnSnapshot = { socket: 'none', send: 'none', recv: 'none' };
  scenario: Scenario = 'unlabelled';
  run = 1;

  label(scenario: Scenario, run: number): void {
    this.scenario = scenario;
    this.run = run;
  }

  /** Manually mark the moment the tester starts the interruption (e.g. "airplane mode ON"). */
  markStart(t: number, note: string): void {
    this.add({ t, kind: 'mark', detail: note });
    this.startEpisode(t, `mark: ${note}`);
  }

  add(o: Observation): void {
    this.observations.push(o);
    switch (o.kind) {
      case 'browser-offline':
      case 'hidden':
      case 'pagehide':
      case 'freeze':
        this.startEpisode(o.t, o.kind);
        break;
      case 'connection':
        if (o.conn) this.onConn(o.t, o.conn);
        break;
      case 'remotes': {
        const target = this.open ?? (this.recent && o.t <= this.recent.until ? this.recent.e : null);
        if (target && o.remoteNames) {
          target.maxRemotes = Math.max(target.maxRemotes, o.remoteNames.length);
          if (hasDuplicates(o.remoteNames)) target.duplicateRemotes = true;
        }
        break;
      }
      case 'local-track':
        if (this.open && /ended|muted/.test(o.detail)) {
          this.open.gestureNeeded = true;
          this.open.notes.push(`local ${o.detail}`);
        }
        break;
      default:
        if (this.open) this.open.notes.push(`${o.kind}: ${o.detail}`);
    }
  }

  private startEpisode(t: number, why: string): void {
    if (this.open) {
      this.open.notes.push(why);
      return;
    }
    this.open = {
      scenario: this.scenario,
      run: this.run,
      startedAt: t,
      detectedAt: null,
      recoveredAt: null,
      recoveryMs: null,
      detectMs: null,
      maxRemotes: 0,
      duplicateRemotes: false,
      gestureNeeded: false,
      notes: [why],
    };
    this.episodes.push(this.open);
  }

  private onConn(t: number, c: ConnSnapshot): void {
    this.conn = c;
    if (SDK_DOWN(c)) {
      this.startEpisode(t, `sdk ${c.socket}/${c.send}/${c.recv}`);
      if (this.open && this.open.detectedAt === null) {
        this.open.detectedAt = t;
        this.open.detectMs = t - this.open.startedAt;
      }
    } else if (this.open && HEALTHY(c)) {
      this.open.recoveredAt = t;
      this.open.recoveryMs = t - this.open.startedAt;
      this.recent = { e: this.open, until: t + 10_000 };
      this.open = null;
    }
  }

  /** Close an open episode without recovery (e.g. manual leave/rejoin used instead). */
  closeUnrecovered(t: number, note: string): void {
    if (!this.open) return;
    this.open.notes.push(`closed without automatic recovery at +${t - this.open.startedAt} ms: ${note}`);
    this.open = null;
  }

  current(): ConnSnapshot {
    return this.conn;
  }
}

/** Markdown table rows for the evidence record (one row per episode). */
export function episodesTable(episodes: Episode[], iso: (t: number) => string = t => new Date(t).toISOString()): string {
  const head = '| Scenario | Run | Started (UTC) | Detected after ms | Recovered after ms | Max remotes (during + 10 s after) | Duplicates | Gesture needed | Notes |\n|---|---|---|---|---|---|---|---|---|';
  const rows = episodes.map(e =>
    [
      e.scenario,
      e.run,
      iso(e.startedAt),
      e.detectMs ?? 'not detected',
      e.recoveryMs ?? 'NOT RECOVERED',
      e.maxRemotes,
      e.duplicateRemotes ? 'YES' : 'no',
      e.gestureNeeded ? 'yes' : 'no',
      e.notes.slice(0, 6).join('; ').replace(/\|/g, '/'),
    ].join(' | '),
  );
  return [head, ...rows.map(r => `| ${r} |`)].join('\n');
}

/** Variability across runs of one scenario (REC AC4). */
export function variability(episodes: Episode[], scenario: Scenario): { runs: number; recovered: number; minMs: number | null; maxMs: number | null; medianMs: number | null } {
  const eps = episodes.filter(e => e.scenario === scenario);
  const ms = eps.map(e => e.recoveryMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = ms.length ? (ms.length % 2 ? ms[(ms.length - 1) / 2] : Math.round((ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2)) : null;
  return { runs: eps.length, recovered: ms.length, minMs: ms[0] ?? null, maxMs: ms[ms.length - 1] ?? null, medianMs: median };
}
