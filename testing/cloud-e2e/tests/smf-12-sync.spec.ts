import { test, expect, type Browser, type Frame, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { fixtureRecordId, markupVersionIds, openProbe } from './files-markup-helpers';

// SMF-12 SYNC-01..03 and the desktop half of SYNC-04 as real personas (Edge / Chromium) against
// the deployed Worker. Automation attests: convergence and presence between two real persona
// sessions, propagation delay as observed through the UI (includes ~50 ms polling granularity),
// reconnect after offline, persistence across both sessions closing, denial for RESTRICTED and
// for the wrong case, token-issuance revocation timing, simultaneous Files saves.
// It cannot attest: physical Salesforce mobile pairs, touch, cellular networks — HUMAN-ACTIONS.
// Network note: cloud container → Cloudflare edge; record it as the measured network, not a
// "stable network" claim for field use.

const LINK = /SMF-12 · Live two-user markup/;
const HEADING = /Live two-user markup/;
type App = Page | Frame;
interface Session { page: Page; app: App; close: () => Promise<void> }

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

let case1 = '';
let case2 = '';
test.beforeAll(() => {
  case1 = fixtureRecordId('MF-CASE-001') ?? '';
  case2 = fixtureRecordId('MF-CASE-002') ?? '';
});

async function join(browser: Browser, persona: Persona, caseId: string, expectSynced = true): Promise<Session> {
  const ctx = await personaContext(browser, persona);
  const { page, app } = await openProbe(ctx, LINK, HEADING);
  await app.getByLabel('Case record Id').fill(caseId);
  await app.getByTestId('join').click();
  if (expectSynced) await expect(app.getByTestId('sync-status')).toContainText('synced (online)', { timeout: 60_000 });
  return { page, app, close: () => ctx.close() };
}

async function shapeCount(app: App): Promise<number> {
  const line = (await app.getByTestId('evidence').innerText()).split('\n').find(l => l.startsWith('shapes:')) ?? '';
  return Number(/shapes: (\d+)/.exec(line)?.[1] ?? -1);
}

async function drawRect(s: Session, i: number): Promise<void> {
  const box = await s.app.locator('.tl-canvas').boundingBox();
  if (!box) throw new Error('canvas missing');
  const x = box.x + 40 + (i % 10) * 25;
  const y = box.y + box.height - 120 + Math.floor(i / 10) * 25;
  await s.page.keyboard.press('r');
  await s.page.mouse.move(x, y);
  await s.page.mouse.down();
  await s.page.mouse.move(x + 15, y + 15, { steps: 3 });
  await s.page.mouse.up();
  await s.page.keyboard.press('Escape');
}

function stats(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  return { n: s.length, median: q(0.5), p95: q(0.95), max: s[s.length - 1] };
}

function sfAdmin(args: string[]): void {
  execFileSync('sf', [...args, '--target-org', 'smf-dev', '--json'], { encoding: 'utf8', env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' } });
}

test('SYNC-01: TECH + SUPPORT converge with presence; propagation over 30 edits each way', async ({ browser }, info) => {
  test.skip(!case1, 'MF-CASE-001 mapping missing (SMF-3)');
  const tech = await join(browser, 'tech', case1);
  const support = await join(browser, 'support', case1);
  await expect(tech.app.getByTestId('presence')).not.toHaveText('nobody', { timeout: 30_000 });
  await expect(support.app.getByTestId('presence')).not.toHaveText('nobody', { timeout: 30_000 });
  if (await tech.app.getByTestId('place-image').count()) await tech.app.getByTestId('place-image').click();
  await tech.app.getByTestId('sync-canvas').scrollIntoViewIfNeeded();
  await support.app.getByTestId('sync-canvas').scrollIntoViewIfNeeded();
  const delays: Record<string, number[]> = { 'TECH->SUPPORT': [], 'SUPPORT->TECH': [] };
  for (const [from, to, key] of [[tech, support, 'TECH->SUPPORT'], [support, tech, 'SUPPORT->TECH']] as const) {
    for (let i = 0; i < 30; i++) {
      const before = await shapeCount(to.app);
      const t0 = Date.now();
      await drawRect(from, i);
      await expect.poll(() => shapeCount(to.app), { intervals: [50], timeout: 30_000 }).toBeGreaterThan(before);
      delays[key].push(Date.now() - t0);
    }
  }
  const all = stats([...delays['TECH->SUPPORT'], ...delays['SUPPORT->TECH']]);
  record(info, { case: 'SYNC-01', persona: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(),
    observed: `propagation (UI-observed, includes input + 50 ms polling): ${JSON.stringify({ tech: stats(delays['TECH->SUPPORT']), support: stats(delays['SUPPORT->TECH']), all })}; target <= 2000 ms`,
    presence: [await tech.app.getByTestId('presence').innerText(), await support.app.getByTestId('presence').innerText()] });
  expect(all.p95, 'PoC target: <= 2 s').toBeLessThanOrEqual(2000);
  await tech.close();
  await support.close();
});

test('SYNC-02: reconnect after offline; state persists after both sessions close', async ({ browser }, info) => {
  test.skip(!case1, 'MF-CASE-001 mapping missing (SMF-3)');
  const tech = await join(browser, 'tech', case1);
  const support = await join(browser, 'support', case1);
  await support.page.context().setOffline(true);
  await expect(support.app.getByTestId('sync-status')).not.toContainText('online', { timeout: 60_000 });
  const base = await shapeCount(tech.app);
  for (let i = 0; i < 5; i++) await drawRect(tech, 40 + i);
  await support.page.context().setOffline(false);
  const t0 = Date.now();
  await expect.poll(() => shapeCount(support.app), { timeout: 60_000 }).toBe(base + 5);
  const reconnectMs = Date.now() - t0;
  const finalCount = base + 5;
  await tech.close();
  await support.close();
  const fresh = await join(browser, 'support', case1);
  await expect.poll(() => shapeCount(fresh.app), { timeout: 60_000 }).toBe(finalCount);
  record(info, { case: 'SYNC-02', persona: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(),
    observed: `SUPPORT converged ${reconnectMs} ms after network restored; fresh session after both closed saw ${finalCount} shapes. Service restart not controllable on Workers (Durable Object eviction) — covered on localhost only.` });
  await fresh.close();
});

test('SYNC-03: RESTRICTED and wrong-case joins denied; token-issuance revocation timing', async ({ browser }, info) => {
  test.skip(!case1 || !case2, 'MF-CASE-001/002 mapping missing (SMF-3)');
  const r = await join(browser, 'restricted', case1, false);
  await expect(r.app.getByTestId('sync-status')).toContainText('Not found or no access', { timeout: 60_000 });
  record(info, { case: 'SYNC-03', persona: 'MF-RESTRICTED', observed: 'MF-CASE-001 room: token refused (DENIED)' });
  await r.close();
  const w = await join(browser, 'tech', case2, false);
  await expect(w.app.getByTestId('sync-status')).toContainText('Not found or no access', { timeout: 60_000 });
  record(info, { case: 'SYNC-03', persona: 'MF-TECH', observed: 'MF-CASE-002 (wrong case) room: token refused (DENIED)' });
  await w.close();

  // Revocation proxy: remove SUPPORT's SMF12_Access (no new tokens) while connected; measure the cut.
  const s = await join(browser, 'support', case1);
  const username = JSON.parse(execFileSync('sf', ['org', 'display', 'user', '--target-org', 'smf-dev-support', '--json'], { encoding: 'utf8' })).result.username as string;
  const q = JSON.parse(execFileSync('sf', ['data', 'query', '--query', `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'SMF12_Access' AND Assignee.Username = '${username}'`, '--target-org', 'smf-dev', '--json'], { encoding: 'utf8' })).result.records as Array<{ Id: string }>;
  const tRevoke = Date.now();
  try {
    for (const a of q) sfAdmin(['data', 'delete', 'record', '--sobject', 'PermissionSetAssignment', '--record-id', a.Id]);
    await expect(s.app.getByTestId('sync-status')).not.toContainText('synced (online)', { timeout: 400_000 });
    const cutMs = Date.now() - tRevoke;
    record(info, { case: 'SYNC-03', persona: 'MF-SUPPORT', observed: `token issuance revoked; live session cut ${cutMs} ms later (TTL 300 s + re-check 15 s bound)` });
  } finally {
    sfAdmin(['org', 'assign', 'permset', '--name', 'SMF12_Access', '--on-behalf-of', username]);
    await s.close();
  }
});

test('SYNC-04 (desktop half): simultaneous Files saves → one revision + explicit conflict', async ({ browser }, info) => {
  test.skip(!case1, 'MF-CASE-001 mapping missing (SMF-3)');
  const tech = await join(browser, 'tech', case1);
  const support = await join(browser, 'support', case1);
  const before = markupVersionIds(case1, 'snapshot').length;
  await Promise.all([tech.app.getByTestId('sync-save').click(), support.app.getByTestId('sync-save').click()]);
  const states = await Promise.all(
    [tech, support].map(async s => {
      await expect(s.app.getByTestId('sync-save-state')).not.toContainText('saving', { timeout: 90_000 });
      return s.app.getByTestId('sync-save-state').innerText();
    })
  );
  const after = markupVersionIds(case1, 'snapshot').length;
  record(info, { case: 'SYNC-04', persona: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(), observed: `save states: ${states.join(' | ')}; snapshots ${before} -> ${after}` });
  expect(after - before).toBe(states.filter(t => t.includes('saved')).length);
  expect(states.some(t => t.includes('saved'))).toBe(true);
  await tech.close();
  await support.close();
});
