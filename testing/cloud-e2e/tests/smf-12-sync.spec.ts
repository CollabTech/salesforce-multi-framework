import { test, expect, type Browser, type Frame, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { readFileSync } from 'node:fs';
import { join as pjoin } from 'node:path';
import { ROOT, fixtureRecordId, latestVersionOf, markupVersionIds, openProbe } from './files-markup-helpers';

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

// Not 'serial': a failed test (e.g. an expected baseline FAIL) must not skip the later runs. Order
// is still sequential (workers: 1), and every test restores what it changes.
test.describe.configure({ mode: 'default' });
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

});

// SYNC-03 / SMF-12 AC4 "deny unauthorized room joins and file access, including after access
// changes" (finding A2). MF-SUPPORT holds a live session in the MF-CASE-001 room and a token
// issued earlier through Apex. Then ONE access change is made, each in its own run:
//   - case-sharing: the SMF-3 manual CaseShare (Edit) on MF-CASE-001 is deleted,
//   - join-permission: SMF12_Access is unassigned (the token endpoint becomes unavailable),
// first with enforcement OFF (baseline: token TTL 300 s + 15 s re-check), then ON
// (SMF12_AccessSweep every minute pushes /revoke). Each run records, with timing from the change:
//   (a) existing connection: when the live session leaves "synced (online)", and when its
//       reconnect is refused a new token;
//   (b) new join with the previously issued token: when it is refused (HTTP status);
//   (c) file access: when MF-IMAGE-001 (a File on the case) stops being readable by MF-SUPPORT
//       (record query and VersionData download as that persona).
// Assertions are the criterion: every one must be denied within the run window. Nothing is relaxed;
// whether the measured times satisfy AC4 is the reviewer's call (docs/findings/token-revocation.md).
const WINDOW_MS = 7 * 60_000; // longer than the baseline bound, so the baseline time is measured
type AccessKind = 'case-sharing' | 'join-permission';

function sfJson(args: string[]): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  return JSON.parse(execFileSync('sf', [...args, '--json'], { encoding: 'utf8', env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' } }));
}
function apexAdmin(code: string): void {
  const file = `/tmp/smf12-apex-${Date.now()}.apex`;
  execFileSync('bash', ['-c', `cat > ${file}`], { input: code });
  execFileSync('sf', ['apex', 'run', '--file', file, '--target-org', 'smf-dev', '--json'], { encoding: 'utf8' });
}
function supportIdentity(): { username: string; id: string } {
  const username = sfJson(['org', 'display', 'user', '--target-org', 'smf-dev-support']).result.username as string;
  const id = sfJson(['data', 'query', '--query', `SELECT Id FROM User WHERE Username = '${username}'`, '--target-org', 'smf-dev']).result.records[0].Id as string;
  return { username, id };
}
interface Issued { token: string; room: string; wsUrl: string }
/** A room token issued to MF-SUPPORT through the real Apex endpoint (kept in memory only). */
function issueAsSupport(caseId: string): Issued {
  const r = sfJson(['api', 'request', 'rest', `/services/apexrest/smf12/v1/cases/${caseId}/room-token`, '--method', 'POST', '--target-org', 'smf-dev-support']);
  const body = typeof r.result.body === 'string' ? JSON.parse(r.result.body) : r.result.body;
  if (r.result.statusCode !== 200 || !body?.token) throw new Error(`MF-SUPPORT could not obtain a room token before the change (HTTP ${r.result.statusCode})`);
  return { token: body.token, room: body.room, wsUrl: body.wsUrl };
}
function appOrigin(): string {
  return JSON.parse(readFileSync(pjoin(ROOT, 'private', 'smf12-app-origin.json'), 'utf8')).appOrigin as string;
}
function joinWith(t: Issued): string {
  return execFileSync('node', [pjoin(ROOT, 'services', 'markup-sync', 'test', 'token-join.mjs')], {
    encoding: 'utf8', env: { ...process.env, SMF12_WS_URL: t.wsUrl, SMF12_ROOM: t.room, SMF12_TOKEN: t.token, SMF12_ORIGIN: appOrigin() },
  }).trim();
}
/** MF-SUPPORT's own view of the File: record visible? download status? */
function supportFileAccess(versionId: string): { visible: boolean; download: string } {
  const rows = sfJson(['data', 'query', '--query', `SELECT Id FROM ContentVersion WHERE Id = '${versionId}'`, '--target-org', 'smf-dev-support']).result.records;
  let download: string;
  try {
    const r = sfJson(['api', 'request', 'rest', `/services/data/v67.0/sobjects/ContentVersion/${versionId}/VersionData`, '--target-org', 'smf-dev-support']);
    download = String(r.result?.statusCode ?? r.status);
  } catch (e) {
    const out = String((e as { stdout?: string }).stdout ?? '');
    download = /"statusCode":\s*(\d+)/.exec(out)?.[1] ?? /"name":\s*"(\w+)"/.exec(out)?.[1] ?? 'error';
  }
  return { visible: rows.length > 0, download };
}
function removeAccess(kind: AccessKind, who: { username: string; id: string }, caseId: string): () => void {
  if (kind === 'join-permission') {
    const psa = sfJson(['data', 'query', '--query', `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'SMF12_Access' AND AssigneeId = '${who.id}'`, '--target-org', 'smf-dev']).result.records;
    for (const a of psa) sfAdmin(['data', 'delete', 'record', '--sobject', 'PermissionSetAssignment', '--record-id', a.Id]);
    return () => sfAdmin(['org', 'assign', 'permset', '--name', 'SMF12_Access', '--on-behalf-of', who.username]);
  }
  const shares = sfJson(['data', 'query', '--query', `SELECT Id, CaseAccessLevel FROM CaseShare WHERE CaseId = '${caseId}' AND RowCause = 'Manual' AND UserOrGroupId = '${who.id}'`, '--target-org', 'smf-dev']).result.records;
  if (shares.length === 0) throw new Error('No manual CaseShare for MF-SUPPORT on MF-CASE-001: SMF-3 baseline not in place; nothing to revoke.');
  for (const sh of shares) sfAdmin(['data', 'delete', 'record', '--sobject', 'CaseShare', '--record-id', sh.Id]);
  return () => { for (const sh of shares) sfAdmin(['data', 'create', 'record', '--sobject', 'CaseShare', '--values', `CaseId=${caseId} UserOrGroupId=${who.id} CaseAccessLevel=${sh.CaseAccessLevel}`]); };
}
async function within(pred: () => Promise<boolean> | boolean, stepMs: number): Promise<number | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < WINDOW_MS) {
    if (await pred()) return Date.now() - t0;
    await new Promise(r => setTimeout(r, stepMs));
  }
  return null;
}
const secs = (ms: number | null): string => (ms === null ? `not within ${WINDOW_MS / 1000} s` : `${(ms / 1000).toFixed(1)} s`);

for (const enforcement of ['baseline (sweep off)', 'enforced (sweep every 1 min)'] as const) {
  for (const kind of ['case-sharing', 'join-permission'] as const) {
    test(`SYNC-03 access change, ${kind}, ${enforcement}: live session, earlier token, file access`, async ({ browser }, info) => {
      test.skip(!case1, 'MF-CASE-001 mapping missing (SMF-3)');
      test.setTimeout(WINDOW_MS + 5 * 60_000);
      const imageDoc = fixtureRecordId('MF-IMAGE-001');
      const imageVersion = imageDoc ? latestVersionOf(imageDoc) : null;
      if (!imageVersion) throw new Error('MF-IMAGE-001 not found (SMF-3 Files baseline missing)');
      apexAdmin(enforcement.startsWith('baseline') ? 'SMF12_AccessSweep.stop();' : 'SMF12_AccessSweep.start(1);');
      const who = supportIdentity();
      const live = await join(browser, 'support', case1);
      const issued = issueAsSupport(case1);
      const before = { join: joinWith(issued), file: supportFileAccess(imageVersion) };
      expect(before.join, 'precondition: the issued token joins before the change').toBe('101');
      expect(before.file.visible, 'precondition: MF-SUPPORT can read MF-IMAGE-001 before the change').toBe(true);

      const restore = removeAccess(kind, who, case1);
      const changedAt = new Date().toISOString();
      let left: number | null = null, refused: number | null = null, oldToken: number | null = null, file: number | null = null;
      let oldTokenStatus = '', fileAfter = before.file;
      try {
        [left, refused, oldToken, file] = await Promise.all([
          within(async () => !(await live.app.getByTestId('sync-status').innerText()).includes('synced (online)'), 1_000),
          within(async () => (await live.app.getByTestId('sync-status').innerText()).includes('Not found or no access'), 2_000),
          within(() => { oldTokenStatus = joinWith(issued); return oldTokenStatus !== '101'; }, 10_000),
          kind === 'case-sharing' ? within(() => { fileAfter = supportFileAccess(imageVersion); return !fileAfter.visible; }, 5_000) : Promise.resolve(null),
        ]);
      } finally {
        restore();
        apexAdmin('SMF12_AccessSweep.stop();');
        await live.close();
      }
      record(info, {
        case: 'SYNC-03', persona: 'MF-SUPPORT', browserVersion: browser.version(), finding: 'A2', accessChange: kind, enforcement, changedAt,
        existingConnection: `left "synced (online)" after ${secs(left)}; reconnect refused a new token after ${secs(refused)}`,
        newJoinWithEarlierToken: oldToken === null ? `still joins after ${WINDOW_MS / 1000} s` : `refused (HTTP ${oldTokenStatus}) after ${secs(oldToken)}`,
        fileAccess: kind === 'case-sharing'
          ? (file === null ? `MF-IMAGE-001 still readable after ${WINDOW_MS / 1000} s` : `MF-IMAGE-001 not readable after ${secs(file)} (download: ${fileAfter.download})`)
          : `not changed by this access change (SMF12_Access grants no record access); readable: ${fileAfter.visible}`,
      });
      expect.soft(left, 'AC4: the existing live session must not continue after the access change').not.toBeNull();
      expect.soft(refused, 'AC4: the reconnect must not obtain a new token').not.toBeNull();
      expect.soft(oldToken, 'AC4: a previously issued token must not join after the access change').not.toBeNull();
      if (kind === 'case-sharing') expect.soft(file, 'AC4: file access must be denied after the access change').not.toBeNull();
    });
  }
}

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
