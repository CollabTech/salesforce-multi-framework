import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startSyncServer, type RunningServer } from '../src/node/server.js';
import { mint, roomIdForCase, signToken, verifyToken } from '../src/shared/token.js';

// Synthetic test secret and Ids; never a real secret or record Id.
const TEST_KEY = ['test', 'only', 'key'].join('-').padEnd(48, 'x'); // throwaway; never a real secret
const USER = ['005', 'TESTUSER0001AAA'].join('');
const CASE_A = ['500', 'TESTCASE0001AAA'].join('');
const CASE_B = ['500', 'TESTCASE0002AAA'].join('');
const now = (): number => Math.floor(Date.now() / 1000);

let srv: RunningServer;
let dir: string;
const events: Array<Record<string, unknown>> = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'smf12-'));
  srv = await startSyncServer({ port: 0, host: '127.0.0.1', secret: TEST_KEY, dataDir: dir, recheckMs: 250, allowedOrigins: [], allowAnyOrigin: true, log: e => events.push(e) });
});
afterAll(async () => {
  await srv.close();
  rmSync(dir, { recursive: true, force: true });
});

function connect(room: string, token?: string): Promise<{ status: number; ws?: WebSocket }> {
  const q = token ? `?token=${encodeURIComponent(token)}&sessionId=s-${Math.random()}` : '';
  return new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/connect/${room}${q}`);
    ws.on('open', () => resolve({ status: 101, ws }));
    ws.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode ?? 0 }));
    ws.on('error', () => undefined);
  });
}

async function mintHttp(body: unknown, key = TEST_KEY): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${srv.port}/mint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-smf-mint-key': key },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: res.status === 200 ? ((await res.json()) as Record<string, unknown>) : {} };
}

describe('tokens', () => {
  it('signs, verifies and binds to the room', async () => {
    const m = await mint({ userId: USER, caseId: CASE_A, ttlSeconds: 60 }, TEST_KEY, now(), 'j1');
    expect((await verifyToken(m.token, TEST_KEY, m.room, now())).ok).toBe(true);
    expect(await verifyToken(m.token, TEST_KEY, await roomIdForCase(CASE_B), now())).toEqual({ ok: false, reason: 'wrong-room' });
    expect(await verifyToken(m.token, 'another-secret'.padEnd(40, 'y'), m.room, now())).toEqual({ ok: false, reason: 'bad-signature' });
    expect(await verifyToken(m.token, TEST_KEY, m.room, m.expiresAt)).toEqual({ ok: false, reason: 'expired' });
  });

  it('caps TTL at 900 s and maps 15/18-char case Ids to the same room', async () => {
    const m = await mint({ userId: USER, caseId: CASE_A, ttlSeconds: 99999 }, TEST_KEY, 1000, 'j');
    expect(m.expiresAt).toBe(1900);
    expect(await roomIdForCase(CASE_A.slice(0, 15))).toBe(await roomIdForCase(CASE_A));
  });

  it('rejects tampered claims', async () => {
    const m = await mint({ userId: USER, caseId: CASE_A }, TEST_KEY, now(), 'j');
    const [v, , s] = m.token.split('.');
    const forged = `${v}.${Buffer.from(JSON.stringify({ v: 1, sub: USER, case: CASE_B, room: await roomIdForCase(CASE_B), iat: now(), exp: now() + 60, jti: 'x' })).toString('base64url')}.${s}`;
    expect((await verifyToken(forged, TEST_KEY, await roomIdForCase(CASE_B), now())).ok).toBe(false);
  });
});

describe('server authorization', () => {
  it('refuses /mint without the mint key', async () => {
    expect((await mintHttp({ userId: USER, caseId: CASE_A }, 'wrong')).status).toBe(401);
    expect((await mintHttp({ userId: 'nope', caseId: CASE_A })).status).toBe(400);
  });

  it('refuses no token, malformed, bad signature, wrong room and expired tokens', async () => {
    const roomA = await roomIdForCase(CASE_A);
    const roomB = await roomIdForCase(CASE_B);
    const good = (await mintHttp({ userId: USER, caseId: CASE_A })).json.token as string;
    const expired = await signToken({ v: 1, sub: USER, case: CASE_A, room: roomA, iat: now() - 100, exp: now() - 1, jti: 'e' }, TEST_KEY);
    const foreign = await signToken({ v: 1, sub: USER, case: CASE_A, room: roomA, iat: now(), exp: now() + 60, jti: 'f' }, 'x'.repeat(40));
    expect((await connect(roomA)).status).toBe(401);
    expect((await connect(roomA, 'garbage')).status).toBe(401);
    expect((await connect(roomA, foreign)).status).toBe(401);
    expect((await connect(roomB, good)).status).toBe(403);
    expect((await connect(roomA, expired)).status).toBe(401);
    expect((await connect('mf-not-a-room', good)).status).toBe(404);
  });

  it('accepts a valid token and closes the session when it expires (revocation timing)', async () => {
    const m = await mint({ userId: USER, caseId: CASE_A, ttlSeconds: 5 }, TEST_KEY, now(), 'short');
    const { status, ws } = await connect(m.room, m.token);
    expect(status).toBe(101);
    const closed = await new Promise<{ code: number; at: number }>(resolve => ws!.on('close', code => resolve({ code, at: Date.now() / 1000 })));
    expect(closed.code).toBe(4001);
    const lateBy = closed.at - m.expiresAt;
    // Worst case: expiry rounding (<1 s) + one re-check interval (0.25 s here).
    expect(lateBy).toBeLessThan(1.5);
    events.push({ event: 'measured-revocation', lateBySeconds: Number(lateBy.toFixed(3)) });
  }, 15_000);
});

describe('origin policy (fail closed)', () => {
  it('denies every origin when the allowlist is empty and allowAny is off', async () => {
    const { originAllowed } = await import('../src/shared/token');
    expect(originAllowed('https://x.my.salesforce.com', [], false)).toBe(false);
    expect(originAllowed(null, [], false)).toBe(false);
  });
  it('allows only listed origins (exact match)', async () => {
    const { originAllowed, parseOrigins } = await import('../src/shared/token');
    const list = parseOrigins(' https://a.lightning.force.com/ ,https://b.my.salesforce.app');
    expect(list).toEqual(['https://a.lightning.force.com', 'https://b.my.salesforce.app']);
    expect(originAllowed('https://a.lightning.force.com', list)).toBe(true);
    expect(originAllowed('https://evil.example', list)).toBe(false);
    expect(originAllowed(undefined, list)).toBe(false);
  });
  it('a server with an empty allowlist rejects a valid token (403)', async () => {
    const d = mkdtempSync(join(tmpdir(), 'smf12-o-'));
    const s = await startSyncServer({ port: 0, host: '127.0.0.1', secret: TEST_KEY, dataDir: d, recheckMs: 250, allowedOrigins: [], log: () => undefined });
    try {
      const m = await fetch(`http://127.0.0.1:${s.port}/mint`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': TEST_KEY },
        body: JSON.stringify({ userId: USER, caseId: CASE_A }),
      }).then(r => r.json() as Promise<Record<string, string>>);
      const status = await new Promise<number>(resolve => {
        const ws = new WebSocket(`ws://127.0.0.1:${s.port}/connect/${m.room}?token=${encodeURIComponent(m.token)}`, { origin: 'https://x.my.salesforce.com' });
        ws.on('open', () => { ws.close(); resolve(101); });
        ws.on('unexpected-response', (_q, r) => resolve(r.statusCode ?? 0));
        ws.on('error', () => undefined);
      });
      expect(status).toBe(403);
    } finally {
      await s.close();
      rmSync(d, { recursive: true, force: true });
    }
  });
});
