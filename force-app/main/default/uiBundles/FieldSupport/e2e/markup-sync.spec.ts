import { Buffer } from 'node:buffer';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { syntheticPumpPng } from './support/syntheticPng';

// ENV-EMULATION-LOCALHOST only (SMF-12). Runs the real SMF-12 sync server (services/markup-sync,
// Node build) on 127.0.0.1 with a throwaway test secret, and two headless Chromium contexts as
// "TECH" and "SUPPORT". Tokens are minted through the server's /mint endpoint exactly as Apex
// would (but without any Salesforce access check — the browser harness decides allow/deny).
// Files are the in-memory mock. Loopback network: latency numbers are NOT a stable-network or
// host measurement. Not Salesforce, persona or device evidence.

const SERVICE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../services/markup-sync');
const SERVER_JS = join(SERVICE, 'dist/node/server.js');
const PORT = 8791;
const TEST_KEY = ['localhost', 'test', 'only', 'key'].join('-').padEnd(48, 'z'); // throwaway; never a real secret
const CASE = '500' + 'MOCKCASE0001AAA';
const USERS = { TECH: '005' + 'MOCKTECH0001AAA', SUPPORT: '005' + 'MOCKSUPP0001AAA' } as const;
type Who = keyof typeof USERS;

let server: ChildProcess | null = null;
let dataDir = '';
const serverLog: string[] = [];

async function startServer(recheckMs = 1000): Promise<void> {
  server = spawn(process.execPath, ['--no-warnings', SERVER_JS], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SMF12_ROOM_TOKEN_SECRET: TEST_KEY, SMF12_DATA_DIR: dataDir, SMF12_RECHECK_MS: String(recheckMs) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d: Buffer) => serverLog.push(d.toString()));
  server.stderr?.on('data', (d: Buffer) => serverLog.push(`[stderr] ${d.toString()}`));
  await expect.poll(async () => (await fetch(`http://127.0.0.1:${PORT}/health`).then(r => r.ok).catch(() => false)), { timeout: 10_000 }).toBe(true);
}

async function stopServer(signal: 'SIGKILL' | 'SIGTERM' = 'SIGKILL'): Promise<void> {
  const s = server;
  server = null;
  if (!s) return;
  await new Promise<void>(res => {
    s.on('exit', () => res());
    s.kill(signal);
  });
}

/** Per-page minting policy (the stand-in for the Apex access check). */
const policy: Record<string, { allow: boolean; ttl: number }> = {};

async function openAs(browser: Browser, who: Who, opts: { seedImage?: boolean; ttl?: number } = {}): Promise<{ ctx: BrowserContext; page: Page; key: string }> {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:5175', viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage();
  page.on('console', m => serverLog.push(`[${who} console] ${m.text()}\n`));
  page.on('websocket', ws => { serverLog.push(`[${who} ws open] ${ws.url().replace(/token=[^&]+/, 'token=…')}\n`); ws.on('close', () => serverLog.push(`[${who} ws close]\n`)); });
  const key = `${who}-${Math.random().toString(36).slice(2, 8)}`;
  policy[key] = { allow: true, ttl: opts.ttl ?? 300 };
  await page.exposeFunction('__smf12Mint', async (caseId: string) => {
    const p = policy[key];
    if (!p.allow) return { error: 'Not found or no access.', status: 404 };
    const res = await fetch(`http://127.0.0.1:${PORT}/mint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-smf-mint-key': TEST_KEY },
      body: JSON.stringify({ userId: USERS[who], caseId, ttlSeconds: p.ttl, displayName: `MF-${who} (mock)` }),
    }).catch(() => null);
    if (!res || !res.ok) return { error: `mint failed ${res?.status ?? 'unreachable'}`, status: res?.status ?? 503 };
    return res.json();
  });
  if (opts.seedImage !== false) {
    const png = syntheticPumpPng();
    await page.addInitScript(
      s => {
        (window as unknown as { __SMF_MOCK_SEED__: unknown }).__SMF_MOCK_SEED__ = s;
      },
      [
        {
          type: 'image/png',
          base64: png.toString('base64'),
          info: { contentDocumentId: '069' + 'MOCKIMG00001AAA', latestVersionId: '068' + 'MOCKIMG00001AAA', linkedEntityId: CASE, title: 'MF-IMAGE-001 (synthetic stand-in)', fileExtension: 'png', fileType: 'PNG', contentSize: png.length, versionNumber: '1', description: null, reasonForChange: null, checksum: null, createdDate: null, shareType: 'V', visibility: 'AllUsers', publicLinkCount: 0 },
        },
      ]
    );
  }
  await page.goto(`/probes/markup-sync?transport=mock&as=${who}`);
  await page.getByTestId('join').click();
  return { ctx, page, key };
}

async function synced(page: Page): Promise<void> {
  await expect(page.getByTestId('sync-status')).toContainText('synced (online)', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => !!window.__SMF_EDITOR__), { timeout: 20_000 }).toBe(true);
}

const shapeCount = (page: Page, type?: string) =>
  page.evaluate(t => window.__SMF_EDITOR__?.getCurrentPageShapes().filter(s => !t || s.type === t).length ?? -1, type ?? null);

async function placeImage(page: Page): Promise<void> {
  await page.getByTestId('place-image').click();
  await expect.poll(() => shapeCount(page, 'image')).toBe(1);
}

function stats(values: number[]): { n: number; median: number; p95: number; max: number } {
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  return { n: v.length, median: q(0.5), p95: q(0.95), max: v[v.length - 1] };
}

/** Creates `count` shapes in `from` and measures arrival time in `to` (same machine clock). */
async function measurePropagation(from: Page, to: Page, count: number, tag: string): Promise<number[]> {
  await to.evaluate(t => {
    const w = window as unknown as { __arrivals: Record<string, number> };
    w.__arrivals = {};
    window.__SMF_EDITOR__!.store.listen(
      e => {
        for (const r of Object.values(e.changes.added)) {
          const meta = (r as { meta?: { probe?: string; sent?: number } }).meta;
          if (meta?.probe === t) w.__arrivals[(r as { id: string }).id] = Date.now() - (meta.sent ?? 0);
        }
      },
      { source: 'remote', scope: 'document' }
    );
  }, tag);
  for (let i = 0; i < count; i++) {
    await from.evaluate(
      ([t, n]) => {
        const ed = window.__SMF_EDITOR__!;
        ed.createShape({ type: 'geo', x: 20 + (n % 10) * 30, y: 500 + Math.floor(n / 10) * 30, props: { w: 20, h: 20 }, meta: { probe: t, sent: Date.now() } });
      },
      [tag, i] as const
    );
    await from.waitForTimeout(100);
  }
  await expect.poll(() => to.evaluate(() => Object.keys((window as unknown as { __arrivals: object }).__arrivals).length), { timeout: 20_000 }).toBe(count);
  return to.evaluate(() => Object.values((window as unknown as { __arrivals: Record<string, number> }).__arrivals));
}

test.describe('SMF-12 live markup (localhost sync server, mock Files)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);
  test.skip(!existsSync(SERVER_JS), 'build services/markup-sync first (npm run build)');

  test.beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'smf12-e2e-'));
    await startServer();
  });
  test.afterAll(async () => {
    await stopServer('SIGTERM');
    rmSync(dataDir, { recursive: true, force: true });
    writeFileSync(join(tmpdir(), 'smf12-e2e-server.log'), serverLog.join(''));
  });

  test('SYNC-01: both sessions converge with presence; propagation delay over 2x30 edits', async ({ browser }) => {
    const a = await openAs(browser, 'TECH');
    const b = await openAs(browser, 'SUPPORT');
    await synced(a.page);
    await synced(b.page);
    await placeImage(a.page);
    await expect.poll(() => shapeCount(b.page, 'image')).toBe(1);
    await expect(a.page.getByTestId('presence')).toContainText('MF-SUPPORT (mock)');
    await expect(b.page.getByTestId('presence')).toContainText('MF-TECH (mock)');

    // TECH red circle, SUPPORT arrow + label (programmatic shapes; mouse drawing is covered in SMF-11).
    await a.page.evaluate(() => {
      window.__SMF_EDITOR__!.createShape({ type: 'geo', x: 60, y: 200, props: { geo: 'ellipse', color: 'red', w: 160, h: 200 } });
    });
    await b.page.evaluate(() => {
      const ed = window.__SMF_EDITOR__!;
      ed.createShape({ type: 'arrow', x: 450, y: 120, props: { start: { x: 0, y: 0 }, end: { x: -220, y: 120 } } });
      ed.createShape({ type: 'text', x: 460, y: 80, props: { richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect inlet' }] }] } } });
    });
    for (const p of [a.page, b.page]) {
      await expect(p.getByTestId('evidence')).toContainText('image true red circle true arrow true label true', { timeout: 10_000 });
    }

    const ab = await measurePropagation(a.page, b.page, 30, 'ab');
    const ba = await measurePropagation(b.page, a.page, 30, 'ba');
    const all = stats([...ab, ...ba]);
    console.log(`SMF12-MEASURE propagation ms TECH->SUPPORT ${JSON.stringify(stats(ab))} SUPPORT->TECH ${JSON.stringify(stats(ba))} all ${JSON.stringify(all)}`);
    expect(all.p95, 'localhost p95 within the 2 s PoC target (loopback only)').toBeLessThanOrEqual(2000);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('SYNC-02: concurrent edits converge; disconnect/reconnect; server crash + restart recovers from persistence', async ({ browser }) => {
    const a = await openAs(browser, 'TECH');
    const b = await openAs(browser, 'SUPPORT');
    await synced(a.page);
    await synced(b.page);
    const baseline = await shapeCount(a.page);

    // Concurrent: both create 10 shapes at once and both move the same shape.
    const target = await a.page.evaluate(() => {
      const ed = window.__SMF_EDITOR__!;
      ed.createShape({ type: 'geo', x: 900, y: 100, props: { w: 40, h: 40 }, meta: { contested: true } });
      return String(ed.getCurrentPageShapes().find(s => (s.meta as { contested?: boolean }).contested)!.id);
    });
    await expect.poll(() => b.page.evaluate(id => !!window.__SMF_EDITOR__!.getShape(id as never), target)).toBe(true);
    await Promise.all(
      [a.page, b.page].map((p, k) =>
        p.evaluate(
          ([id, k2]) => {
            const ed = window.__SMF_EDITOR__!;
            for (let i = 0; i < 10; i++) ed.createShape({ type: 'geo', x: 900 + k2 * 60, y: 200 + i * 30, props: { w: 20, h: 20 } });
            (ed as unknown as { updateShape(p: Record<string, unknown>): void }).updateShape({ id, type: 'geo', x: 1000 + k2 * 200 });
          },
          [target, k] as const
        )
      )
    );
    const expected = baseline + 21;
    await expect.poll(() => shapeCount(a.page)).toBe(expected);
    await expect.poll(() => shapeCount(b.page)).toBe(expected);
    const xs = await Promise.all([a.page, b.page].map(p => p.evaluate(id => window.__SMF_EDITOR__!.getShape(id as never)!.x, target)));
    expect(xs[0]).toBe(xs[1]);
    console.log(`SMF12-MEASURE concurrent: 20 creates + contested move converged; contested x=${xs[0]} (last writer wins)`);

    // Disconnect SUPPORT (DevTools offline), TECH edits, SUPPORT reconnects.
    const cdp = await b.ctx.newCDPSession(b.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await expect(b.page.getByTestId('sync-status')).not.toContainText('online', { timeout: 30_000 });
    await a.page.evaluate(() => {
      for (let i = 0; i < 5; i++) window.__SMF_EDITOR__!.createShape({ type: 'geo', x: 1200, y: 200 + i * 30, props: { w: 20, h: 20 } });
    });
    const tOnline = Date.now();
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await synced(b.page);
    await expect.poll(() => shapeCount(b.page), { timeout: 30_000 }).toBe(expected + 5);
    console.log(`SMF12-MEASURE reconnect: SUPPORT converged ${Date.now() - tOnline} ms after network restored`);

    // Crash the server (SIGKILL), restart, and join from a FRESH context: state comes from SQLite.
    await a.ctx.close();
    await b.ctx.close();
    await stopServer('SIGKILL');
    await startServer();
    const c = await openAs(browser, 'SUPPORT');
    await synced(c.page);
    await expect.poll(() => shapeCount(c.page), { timeout: 20_000 }).toBe(expected + 5);
    await expect(c.page.getByTestId('evidence')).toContainText('image true red circle true arrow true label true');
    console.log(`SMF12-MEASURE restart: fresh client after SIGKILL + restart saw ${expected + 5} shapes (persisted)`);

    // Live clients across a restart: both reconnect and converge, including an edit made while down.
    const d = await openAs(browser, 'TECH');
    await synced(d.page);
    await stopServer('SIGKILL');
    await expect(d.page.getByTestId('sync-status')).not.toContainText('online', { timeout: 30_000 });
    await d.page.evaluate(() => {
      window.__SMF_EDITOR__!.createShape({ type: 'geo', x: 1300, y: 600, props: { w: 30, h: 30 } });
    });
    await startServer();
    await synced(d.page);
    await synced(c.page);
    await expect.poll(() => shapeCount(c.page), { timeout: 30_000 }).toBe(expected + 6);
    await c.ctx.close();
    await d.ctx.close();
  });

  test('SYNC-03: denied join without access; asset resolved per user; revoked access enforced at token expiry', async ({ browser }) => {
    serverLog.push(`[test] SYNC-03 start ${new Date().toISOString()}\n`);
    // Denied (stand-in for Apex refusing MF-RESTRICTED): no token → never synced.
    const r = await openAs(browser, 'SUPPORT');
    policy[r.key].allow = false;
    await r.page.reload();
    await r.page.getByTestId('join').click();
    await expect(r.page.getByTestId('sync-status')).toContainText('token: Not found or no access', { timeout: 20_000 });
    expect(await shapeCount(r.page)).toBe(-1);
    await r.ctx.close();

    // Asset access is per user: a member whose Files access cannot read the image sees the
    // shared shapes but the image does not render (no bytes pass through the sync service).
    const noFiles = await openAs(browser, 'SUPPORT', { seedImage: false });
    await synced(noFiles.page);
    await expect.poll(() => shapeCount(noFiles.page, 'image')).toBe(1);
    await noFiles.page.waitForTimeout(3000);
    const rendered = await noFiles.page
      .locator('.tl-image')
      .evaluateAll(els => els.reduce((m, el) => Math.max(m, el instanceof HTMLImageElement ? el.naturalWidth : (el.querySelector('img')?.naturalWidth ?? 0)), 0));
    expect(rendered).toBe(0);
    await noFiles.ctx.close();

    serverLog.push(`[test] SYNC-03 revocation part ${new Date().toISOString()}\n`);
    // Revocation: restart with a 1 s re-check, connect with 8 s tokens, revoke after 2 s.
    await stopServer('SIGTERM');
    await startServer(1000);
    const a = await openAs(browser, 'TECH', { ttl: 8 });
    await synced(a.page);
    const tJoin = Date.now();
    await a.page.waitForTimeout(2000);
    policy[a.key].allow = false;
    const tRevoke = Date.now();
    await expect(a.page.getByTestId('sync-status')).not.toContainText('synced (online)', { timeout: 30_000 });
    const tCut = Date.now();
    serverLog.push(`[test] revocation cut observed at ${new Date(tCut).toISOString()}\n`);
    await a.page.waitForTimeout(5000);
    await expect(a.page.getByTestId('sync-status')).not.toContainText('synced (online)');
    console.log(`SMF12-MEASURE revocation: TTL 8 s, re-check 1 s; access revoked ${tRevoke - tJoin} ms after join; session cut ${tCut - tRevoke} ms after revocation (${tCut - tJoin} ms after join); stayed disconnected 5 s`);
    expect(tCut - tRevoke).toBeLessThanOrEqual(8000 + 1000 + 2000);
    await a.ctx.close();
  });
});
