import { execFileSync } from 'node:child_process';
import { test, expect, type BrowserContext, type Frame, type Page } from '@playwright/test';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { openProbe } from './smf-media';

// SMF-7 CALL-01..03 in cloud desktop rows (ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM separately) as
// the real personas in the deployed app, against the real Apex boundary and RealtimeKit, with
// FAKE camera/mic. Attests: server-side allow/deny (RESTRICTED, wrong case), invalid/tampered/
// revoked tokens rejected without retry or leakage, join/leave/mute/camera state propagation,
// media flowing both ways (remote frames, remote audio energy, decoded changing marker) for
// desktop↔desktop. Does NOT attest: audio HEARD or video SEEN by a person (CALL-01 phrase),
// real devices, mobile rows. Those are HUMAN-ACTIONS (docs/test-scripts/SMF-7-CALL.md).
// Needs stage 45 (RealtimeKit config + owner step O-SMF7-1).

const HEADING = 'Two-person call (RealtimeKit)';
const CASE1 = 'Pump overheating — remote diagnosis';
const CASE2 = 'MF-CASE-002 restricted negative control (synthetic)';
const CALL_MS = Number(process.env.SMF7_CALL_MS ?? 5 * 60 * 1000);

function adminCaseId(subject: string): string {
  const out = execFileSync('sf', ['data', 'query', '--query', `SELECT Id FROM Case WHERE Subject = '${subject.replace(/'/g, "\\'")}' LIMIT 1`, '--target-org', 'smf-dev', '--json'], {
    encoding: 'utf8',
  });
  return JSON.parse(out).result.records[0].Id as string; // used in the browser only; never recorded
}

async function probeFor(ctx: BrowserContext): Promise<{ page: Page; app: Page | Frame }> {
  const page = ctx.pages()[0];
  return { page, app: await openProbe(page, 'SMF-7', HEADING) };
}

async function joinRoom1(app: Page | Frame, role: 'TECH' | 'SUPPORT'): Promise<void> {
  await app.getByRole('button', { name: role, exact: true }).click();
  await app.getByTestId('find-case').click();
  await expect(app.getByTestId('case-lookup')).toHaveText('MF-CASE-001 visible to you (id hidden)', { timeout: 30_000 });
  await app.getByTestId('join').click();
  await expect(app.getByTestId('phase')).toHaveText('joined', { timeout: 60_000 });
  await app.getByTestId('toggle-mic').click();
  await app.getByTestId('toggle-camera').click();
}

const cell = async (app: Page | Frame, id: string): Promise<string> => (await app.getByTestId(id).first().textContent()) ?? '';
const markerOf = (t: string): number | null => (/marker (\d+)/.exec(t) ? Number(/marker (\d+)/.exec(t)![1]) : null);
const levelOf = (t: string): number => Number(/level ([\d.]+)/.exec(t)?.[1] ?? 0);

/** Token-endpoint and RealtimeKit request counters (URLs only; bodies never read here). */
function countRequests(ctx: BrowserContext): { token: number; rtk: number } {
  const c = { token: 0, rtk: 0 };
  ctx.on('request', r => {
    if (r.url().includes('/services/apexrest/smf7/v1/call-token')) c.token += 1;
    if (r.url().includes('realtime.cloudflare.com')) c.rtk += 1;
  });
  return c;
}

test.describe('SMF-7 CALL-03 authorization boundary', () => {
  for (const [persona, subject, label] of [
    ['restricted', CASE1, 'MF-RESTRICTED → MF-ROOM-001'],
    ['tech', CASE2, 'MF-TECH → MF-ROOM-002 (wrong case)'],
    ['support', CASE2, 'MF-SUPPORT → MF-ROOM-002 (wrong case)'],
  ] as [Persona, string, string][]) {
    test(`denied: ${label}`, async ({ browser }, info) => {
      const ctx = await personaContext(browser, persona);
      const counts = countRequests(ctx);
      const { app } = await probeFor(ctx);
      await app.getByTestId('manual-case').fill(adminCaseId(subject));
      await app.getByTestId('join-manual').click();
      await expect(app.getByTestId('phase')).toHaveText('denied', { timeout: 30_000 });
      const code = await cell(app, 'denial-code');
      const html = await app.locator('body').innerHTML();
      record(info, { case: 'CALL-03', persona: `MF-${persona.toUpperCase()}`, browserVersion: browser.version(), control: label, code, tokenCalls: counts.token, rtkRequests: counts.rtk });
      expect(code).toBe('NO_CASE_ACCESS');
      expect(counts.rtk).toBe(0);
      expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
      await ctx.close();
    });
  }

  test('RESTRICTED cannot even find MF-CASE-001', async ({ browser }, info) => {
    const ctx = await personaContext(browser, 'restricted');
    const { app } = await probeFor(ctx);
    await app.getByTestId('find-case').click();
    await expect(app.getByTestId('case-lookup')).toHaveText(/not visible|lookup failed/, { timeout: 30_000 });
    record(info, { case: 'CALL-03', persona: 'MF-RESTRICTED', browserVersion: browser.version(), observed: await cell(app, 'case-lookup') });
    await expect(app.getByTestId('join')).toBeDisabled();
    await ctx.close();
  });

  test('invalid, tampered and revoked tokens are rejected once, never shown', async ({ browser }, info) => {
    const ctx = await personaContext(browser, 'tech');
    const counts = countRequests(ctx);
    let issued: string | null = null;
    ctx.on('response', async r => {
      if (r.url().includes('/services/apexrest/smf7/v1/call-token') && r.ok()) {
        issued = ((await r.json().catch(() => ({}))) as { authToken?: string }).authToken ?? null; // memory only
      }
    });
    const { page, app } = await probeFor(ctx);
    const results: Record<string, string> = {};

    await app.getByTestId('join-invalid').click();
    await expect(app.getByTestId('phase')).toHaveText('failed', { timeout: 60_000 });
    results.invalid = await cell(app, 'failure-code');

    await app.getByRole('button', { name: 'TECH', exact: true }).click();
    await app.getByTestId('find-case').click();
    await expect(app.getByTestId('case-lookup')).toHaveText('MF-CASE-001 visible to you (id hidden)', { timeout: 30_000 });
    await app.getByTestId('join').click();
    await expect(app.getByTestId('phase')).toHaveText('joined', { timeout: 60_000 });
    await app.getByTestId('leave-call').click();
    await expect(app.getByTestId('phase')).toHaveText('left');

    const tokenCallsBefore = counts.token;
    await app.getByTestId('join-tampered').click();
    await expect(app.getByTestId('phase')).toHaveText(/failed|joined/, { timeout: 60_000 });
    results.tampered = (await cell(app, 'phase')) === 'joined' ? 'JOINED (signature not enforced!)' : await cell(app, 'failure-code');
    if ((await cell(app, 'phase')) === 'joined') await app.getByTestId('leave-call').click();

    // Revoked participant (stand-in for "expired": RealtimeKit tokens live 100 days; pending owner decision C-SMF7-1).
    expect(issued, 'token response observed').not.toBeNull();
    const claims = JSON.parse(Buffer.from(issued!.split('.')[1], 'base64url').toString()) as { meetingId?: string; participantId?: string };
    execFileSync('python3', ['scripts/cloud/smf7_realtimekit.py', 'revoke', String(claims.meetingId), String(claims.participantId)], { cwd: '../..', stdio: 'ignore' });
    issued = null;
    await app.getByTestId('rejoin-last').click();
    await expect(app.getByTestId('phase')).toHaveText(/failed|joined/, { timeout: 60_000 });
    results.revoked = (await cell(app, 'phase')) === 'joined' ? 'JOINED (revocation not enforced!)' : await cell(app, 'failure-code');
    await page.waitForTimeout(10_000);
    const html = await app.locator('body').innerHTML();
    record(info, { case: 'CALL-03', persona: 'MF-TECH', browserVersion: browser.version(), results, tokenCallsDuringNegativeControls: counts.token - tokenCallsBefore,
      tokenInDom: /eyJ[A-Za-z0-9_-]{10,}\./.test(html) });
    expect(results.invalid).toBe('TOKEN_REJECTED');
    expect(results.tampered).not.toMatch(/^JOINED/);
    expect(results.revoked).not.toMatch(/^JOINED/);
    expect(counts.token - tokenCallsBefore, 'no automatic re-authorization').toBe(0);
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
    await ctx.close();
  });
});

test.describe('SMF-7 CALL-01/02 desktop↔desktop (fake devices)', () => {
  test('TECH + SUPPORT: join, media both ways, marker changes remotely, mute/camera/leave/rejoin', async ({ browser }, info) => {
    test.setTimeout(CALL_MS + 6 * 60_000);
    const techCtx = await personaContext(browser, 'tech');
    const supCtx = await personaContext(browser, 'support');
    const techProbe = await probeFor(techCtx);
    const tech = techProbe.app;
    const sup = (await probeFor(supCtx)).app;
    await joinRoom1(tech, 'TECH');
    await joinRoom1(sup, 'SUPPORT');
    await expect(tech.getByTestId('receive-row')).toHaveCount(1, { timeout: 60_000 });
    await expect(sup.getByTestId('receive-row')).toHaveCount(1, { timeout: 60_000 });

    const samples: Record<string, unknown>[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < CALL_MS) {
      await techProbe.page.waitForTimeout(Math.min(30_000, CALL_MS));
      const s = {
        atS: Math.round((Date.now() - t0) / 1000),
        techRecvVideo: await cell(tech, 'receive-video'),
        techRecvAudio: await cell(tech, 'receive-audio'),
        supRecvVideo: await cell(sup, 'receive-video'),
        supRecvAudio: await cell(sup, 'receive-audio'),
        techPhase: await cell(tech, 'phase'),
        supPhase: await cell(sup, 'phase'),
      };
      samples.push(s);
    }
    const last = samples[samples.length - 1] as Record<string, string>;
    const distinct = (t: string): number => Number(/changes\/10 s (\d+)/.exec(t)?.[1] ?? 0);

    // CALL-02 state propagation (send/receive recorded separately)
    const steps: Record<string, string> = {};
    await tech.getByTestId('toggle-mic').click();
    await expect(sup.getByTestId('receive-audio')).toContainText('muted', { timeout: 15_000 });
    steps.techMuteSeenBySupport = await cell(sup, 'receive-audio');
    await tech.getByTestId('toggle-mic').click();
    await expect(sup.getByTestId('receive-audio')).toContainText('on', { timeout: 15_000 });
    await tech.getByTestId('toggle-camera').click();
    await expect(sup.getByTestId('receive-video')).toContainText('off', { timeout: 15_000 });
    steps.techCameraOffSeenBySupport = await cell(sup, 'receive-video');
    await tech.getByTestId('toggle-camera').click();
    await expect(sup.getByTestId('receive-video')).toContainText('on', { timeout: 15_000 });
    await sup.getByTestId('toggle-mic').click();
    await expect(tech.getByTestId('receive-audio')).toContainText('muted', { timeout: 15_000 });
    steps.supportMuteSeenByTech = await cell(tech, 'receive-audio');
    await sup.getByTestId('toggle-mic').click();
    await tech.getByTestId('leave-call').click();
    await expect(sup.getByTestId('receive-row')).toHaveCount(0, { timeout: 30_000 });
    steps.techLeftSeenBySupport = 'remote rows 0';
    steps.techLastLeave = (await cell(tech, 'diagnostics')).split('\n').find(l => l.startsWith('last leave')) ?? '';
    await joinRoom1(tech, 'TECH');
    await expect(sup.getByTestId('receive-row')).toHaveCount(1, { timeout: 60_000 });
    steps.techRejoinedSeenBySupport = 'remote rows 1 (no duplicate)';

    record(info, { case: 'CALL-01', personas: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(), devices: 'fake', durationS: Math.round((Date.now() - t0) / 1000), samples });
    record(info, { case: 'CALL-02', personas: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(), pair: 'desktop↔desktop (same cloud host)', steps });
    expect(last.techPhase).toBe('joined');
    expect(last.supPhase).toBe('joined');
    expect(distinct(last.techRecvVideo), 'SUPPORT marker changing at TECH').toBeGreaterThanOrEqual(5);
    expect(distinct(last.supRecvVideo), 'TECH marker changing at SUPPORT').toBeGreaterThanOrEqual(5);
    expect(levelOf(last.techRecvAudio), 'audio energy received by TECH').toBeGreaterThan(0);
    expect(levelOf(last.supRecvAudio), 'audio energy received by SUPPORT').toBeGreaterThan(0);
    expect(markerOf(last.techRecvVideo)).not.toBeNull();
    await techCtx.close();
    await supCtx.close();
  });
});

// CALL-03 / SMF-7 AC2 "deny unauthorized room access" after an ACCESS CHANGE (finding A1).
// Two independent runs, baseline first: enforcement OFF (SMF7_AccessSweep stopped), then ON
// (sweep every minute). Each run removes one kind of access from a user who already holds a token
// and measures (a) an EXISTING connection: is it cut, and after how long; (b) a NEW JOIN with the
// previously issued token: rejected, and after how long. Access kinds, recorded separately:
// SMF7_Access unassigned (join permission) and the manual CaseShare removed (case sharing).
// The assertion is the criterion (must not join / must be cut), never relaxed; the baseline is
// expected to fail it and is recorded as such.
const LIMIT_MS = 6 * 60_000;

function apexAdmin(code: string): string {
  const file = `/tmp/smf7-apex-${Date.now()}.apex`;
  execFileSync('bash', ['-c', `cat > ${file}`], { input: code });
  return execFileSync('sf', ['apex', 'run', '--file', file, '--target-org', 'smf-dev', '--json'], { encoding: 'utf8' });
}
function sfJson(args: string[]): { result: { records: Array<Record<string, string>> } } {
  return JSON.parse(execFileSync('sf', [...args, '--target-org', 'smf-dev', '--json'], { encoding: 'utf8' }));
}
function personaUsername(alias: string): string {
  return JSON.parse(execFileSync('sf', ['org', 'display', 'user', '--target-org', alias, '--json'], { encoding: 'utf8' })).result.username as string;
}

type AccessKind = 'join-permission' | 'case-sharing';
interface Removal { restore: () => void }

function removeAccess(kind: AccessKind, persona: 'support', caseId: string): Removal {
  const username = personaUsername(`smf-dev-${persona}`);
  if (kind === 'join-permission') {
    const psa = sfJson(['data', 'query', '--query', `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'SMF7_Access' AND Assignee.Username = '${username}'`]).result.records;
    for (const a of psa) execFileSync('sf', ['data', 'delete', 'record', '--sobject', 'PermissionSetAssignment', '--record-id', a.Id, '--target-org', 'smf-dev', '--json']);
    return { restore: () => execFileSync('sf', ['org', 'assign', 'permset', '--name', 'SMF7_Access', '--on-behalf-of', username, '--target-org', 'smf-dev', '--json']) };
  }
  // UserOrGroup is polymorphic, so resolve the user Id first. The SMF-3 baseline grants MF-SUPPORT a
  // manual Edit share on MF-CASE-001 (testing/provisioning/apex/seed.apex); without it the run is invalid.
  const userId = sfJson(['data', 'query', '--query', `SELECT Id FROM User WHERE Username = '${username}'`]).result.records[0].Id;
  const shares = sfJson(['data', 'query', '--query', `SELECT Id, CaseAccessLevel, UserOrGroupId FROM CaseShare WHERE CaseId = '${caseId}' AND RowCause = 'Manual' AND UserOrGroupId = '${userId}'`]).result.records;
  if (shares.length === 0) throw new Error('No manual CaseShare for MF-SUPPORT on MF-CASE-001: SMF-3 baseline not in place; nothing to revoke.');
  for (const sh of shares) execFileSync('sf', ['data', 'delete', 'record', '--sobject', 'CaseShare', '--record-id', sh.Id, '--target-org', 'smf-dev', '--json']);
  return { restore: () => { for (const sh of shares) execFileSync('sf', ['data', 'create', 'record', '--sobject', 'CaseShare', '--values', `CaseId=${caseId} UserOrGroupId=${sh.UserOrGroupId} CaseAccessLevel=${sh.CaseAccessLevel}`, '--target-org', 'smf-dev', '--json']); } };
}

async function waitFor(pred: () => Promise<boolean>, limitMs: number, stepMs = 5_000): Promise<number | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs) {
    if (await pred()) return Date.now() - t0;
    await new Promise(r => setTimeout(r, stepMs));
  }
  return null;
}

for (const enforcement of ['baseline (sweep off)', 'enforced (sweep every 1 min)'] as const) {
  for (const kind of ['join-permission', 'case-sharing'] as const) {
    test(`CALL-03 access change, ${kind}, ${enforcement}: existing connection and old token`, async ({ browser }, info) => {
      test.setTimeout(20 * 60_000);
      apexAdmin(enforcement.startsWith('baseline') ? 'SMF7_AccessSweep.stop();' : 'SMF7_AccessSweep.start(1);');
      const caseId = adminCaseId('Pump overheating — remote diagnosis');
      // (a) existing connection
      const live = await personaContext(browser, 'support');
      const { app: liveApp } = await probeFor(live);
      await joinRoom1(liveApp, 'SUPPORT');
      // (b) a second session that joins, leaves, and keeps its issued token for a later rejoin
      const old = await personaContext(browser, 'support');
      const { app: oldApp } = await probeFor(old);
      await joinRoom1(oldApp, 'SUPPORT');
      await oldApp.getByTestId('leave-call').click();
      await expect(oldApp.getByTestId('phase')).toHaveText('left');

      const removal = removeAccess(kind, 'support', caseId);
      const tRemoved = Date.now();
      let existingCutMs: number | null = null;
      let oldTokenRejectedMs: number | null = null;
      let rejoinCode = '';
      try {
        const cut = waitFor(async () => (await cell(liveApp, 'phase')) !== 'joined', LIMIT_MS);
        const rejected = waitFor(async () => {
          await oldApp.getByTestId('rejoin-last').click();
          await expect(oldApp.getByTestId('phase')).toHaveText(/failed|joined/, { timeout: 60_000 });
          if ((await cell(oldApp, 'phase')) === 'joined') {
            await oldApp.getByTestId('leave-call').click();
            await expect(oldApp.getByTestId('phase')).toHaveText('left');
            return false;
          }
          rejoinCode = await cell(oldApp, 'failure-code');
          return true;
        }, LIMIT_MS, 20_000);
        [existingCutMs, oldTokenRejectedMs] = await Promise.all([cut, rejected]);
      } finally {
        removal.restore();
        apexAdmin('SMF7_AccessSweep.stop();');
        await live.close();
        await old.close();
      }
      record(info, {
        case: 'CALL-03', persona: 'MF-SUPPORT', browserVersion: browser.version(), finding: 'A1', accessChange: kind, enforcement,
        existingConnection: existingCutMs === null ? `still joined after ${LIMIT_MS / 1000} s` : `cut after ${Math.round(existingCutMs / 1000)} s`,
        newJoinWithOldToken: oldTokenRejectedMs === null ? `still joined after ${LIMIT_MS / 1000} s` : `rejected (${rejoinCode}) after ${Math.round(oldTokenRejectedMs / 1000)} s`,
        observedAt: new Date(tRemoved).toISOString(),
      });
      expect.soft(oldTokenRejectedMs, 'SMF-7 AC2: a previously issued token must not join after the access change').not.toBeNull();
      expect.soft(existingCutMs, 'SMF-7 AC2: an existing connection must not continue after the access change').not.toBeNull();
    });
  }
}
