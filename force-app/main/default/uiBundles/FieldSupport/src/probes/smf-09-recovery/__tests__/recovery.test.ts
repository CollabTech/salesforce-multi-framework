import { describe, expect, it } from 'vitest';
import { RecoveryTracker, episodesTable, hasDuplicates, variability } from '../recovery';

// Unit tests of the SMF-9 tracker on synthetic observation sequences (no call, no device).

const C = (socket: string, send = socket, recv = socket) => ({ socket, send, recv });

describe('RecoveryTracker', () => {
  it('network loss: start at offline, detect at SDK disconnect, recover when all connected', () => {
    const r = new RecoveryTracker();
    r.label('network-loss', 1);
    r.add({ t: 0, kind: 'connection', detail: '', conn: C('connected') });
    r.add({ t: 1000, kind: 'browser-offline', detail: '' });
    r.add({ t: 3500, kind: 'connection', detail: '', conn: C('disconnected') });
    r.add({ t: 9000, kind: 'browser-online', detail: '' });
    r.add({ t: 10_000, kind: 'connection', detail: '', conn: C('reconnecting', 'disconnected', 'disconnected') });
    r.add({ t: 12_000, kind: 'connection', detail: '', conn: C('connected', 'connecting', 'connected') });
    expect(r.episodes[0].recoveredAt).toBeNull();
    r.add({ t: 12_400, kind: 'connection', detail: '', conn: C('connected') });
    expect(r.episodes).toHaveLength(1);
    expect(r.episodes[0]).toMatchObject({ scenario: 'network-loss', run: 1, detectMs: 2500, recoveryMs: 11_400 });
  });

  it('counts remotes reported shortly after recovery (duplicates on rejoin)', () => {
    const r = new RecoveryTracker();
    r.add({ t: 0, kind: 'browser-offline', detail: '' });
    r.add({ t: 10, kind: 'connection', detail: '', conn: C('disconnected') });
    r.add({ t: 100, kind: 'connection', detail: '', conn: C('connected') });
    r.add({ t: 150, kind: 'remotes', detail: '', remoteNames: ['Support', 'Support'] });
    r.add({ t: 20_000, kind: 'remotes', detail: '', remoteNames: ['A', 'B', 'C'] });
    expect(r.episodes[0]).toMatchObject({ maxRemotes: 2, duplicateRemotes: true });
  });

  it('SDK-only disconnect opens and closes an episode', () => {
    const r = new RecoveryTracker();
    r.add({ t: 5, kind: 'connection', detail: '', conn: C('failed') });
    r.add({ t: 50, kind: 'connection', detail: '', conn: C('connected') });
    expect(r.episodes[0]).toMatchObject({ detectMs: 0, recoveryMs: 45 });
  });

  it('flags duplicate participants and gesture needs during an episode', () => {
    const r = new RecoveryTracker();
    r.add({ t: 0, kind: 'hidden', detail: '' });
    r.add({ t: 10, kind: 'remotes', detail: '', remoteNames: ['Support', 'Support'] });
    r.add({ t: 20, kind: 'local-track', detail: 'video muted' });
    expect(r.episodes[0]).toMatchObject({ maxRemotes: 2, duplicateRemotes: true, gestureNeeded: true });
  });

  it('unrecovered episodes stay visible', () => {
    const r = new RecoveryTracker();
    r.add({ t: 0, kind: 'browser-offline', detail: '' });
    r.closeUnrecovered(60_000, 'manual leave/rejoin');
    expect(r.episodes[0].recoveryMs).toBeNull();
    expect(episodesTable(r.episodes, () => 'T')).toContain('NOT RECOVERED');
  });

  it('variability over three runs', () => {
    const r = new RecoveryTracker();
    [1000, 3000, 2000].forEach((ms, i) => {
      r.label('lock-unlock', i + 1);
      r.add({ t: i * 100_000, kind: 'hidden', detail: '' });
      r.add({ t: i * 100_000 + 10, kind: 'connection', detail: '', conn: C('disconnected') });
      r.add({ t: i * 100_000 + ms, kind: 'connection', detail: '', conn: C('connected') });
    });
    expect(variability(r.episodes, 'lock-unlock')).toEqual({ runs: 3, recovered: 3, minMs: 1000, maxMs: 3000, medianMs: 2000 });
  });

  it('hasDuplicates', () => {
    expect(hasDuplicates(['a', 'b'])).toBe(false);
    expect(hasDuplicates(['a', 'a'])).toBe(true);
  });
});
