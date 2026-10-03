import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, expect, type Frame, type Page } from '@playwright/test';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { openProbe, probeEvidence } from './smf-3d-helpers';

/**
 * SMF-14 in cloud desktop browsers as real personas on the deployed app.
 * Automation CAN attest: BUDGET-03 authorized delivery of model + embedded textures for MF-TECH
 * over both user-context paths, denial for MF-RESTRICTED (MF-CASE-001 Files) and for MF-TECH
 * (MF-CASE-002 denied copies), the network requests made while loading (no texture fetch), and the
 * bundled-asset path that is not case-checked. It also runs the BUDGET-01/02 harness, but the
 * numbers are SwiftShader software rendering: recorded only as a separate cloud row, never a
 * device budget. CANNOT attest (human rows): device performance, physical rotation, mobile
 * foreground recovery, physical Salesforce mobile.
 */
const PROBE = { link: /SMF-14 · 3D delivery and budget/, heading: '3D delivery and budget probe' };
const ROOT = resolve(__dirname, '../../..');

interface ModelIds {
  'MF-CASE-001': string;
  'MF-CASE-002': string;
  files: Record<string, { contentDocumentId: string; contentVersionId: string; case: string }>;
}

function ids(): ModelIds | null {
  const f = join(ROOT, 'private', 'smf14-model-files.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as ModelIds) : null;
}

async function idle(probe: Frame, timeout = 120_000): Promise<void> {
  await expect(probe.getByTestId('busy')).toHaveCount(0, { timeout });
}

async function start(page: Page, envRow: string, caseId: string): Promise<Frame> {
  const probe = await openProbe(page, PROBE.link, PROBE.heading);
  await probe.getByLabel('Environment row').selectOption(envRow === 'ENV-DESKTOP-EDGE' ? 'ENV-DESKTOP-EDGE' : 'ENV-CLOUD-CHROMIUM');
  await probe.getByLabel(/Device \/ browser/).fill(`cloud ${envRow}, Linux, software WebGL`);
  await probe.getByLabel(/Case Id/).fill(caseId);
  return probe;
}

async function tryDeny(probe: Frame, pathLabel: string, id: string): Promise<void> {
  await probe.getByLabel('Delivery path').selectOption({ label: pathLabel });
  await probe.getByLabel(/Id expected to be denied/).fill(id);
  await probe.getByRole('button', { name: 'Try fetch (expect denial)' }).click();
  await idle(probe);
}

const PATHS = { connect: 'Connect REST file content (user context)', apex: 'SMF-10 Apex REST (user context, with sharing)' };

test('BUDGET-03 tech: authorized delivery on both paths, denied copies on MF-CASE-002, no texture fetch', async ({ browser }, info) => {
  const map = ids();
  test.skip(!map, 'BLOCKED: private/smf14-model-files.json missing (stage 47)');
  if (!map) return;
  const ctx = await personaContext(browser, 'tech');
  const page = ctx.pages()[0];
  const probe = await start(page, info.project.name, map['MF-CASE-001']);
  await probe.getByRole('button', { name: 'List model Files on the case' }).click();
  await expect(probe.getByTestId('model-list')).toContainText('MF-MODEL-REP', { timeout: 60_000 });
  const rows = probe.getByTestId('model-list').locator('li');
  for (const pathLabel of [PATHS.connect, PATHS.apex]) {
    await probe.getByLabel('Delivery path').selectOption({ label: pathLabel });
    for (const i of [0, 1]) {
      await rows.nth(i).getByRole('button', { name: 'Check delivery' }).click();
      await idle(probe);
    }
  }
  await tryDeny(probe, PATHS.connect, map.files['MF-MODEL-SMALL-DENIED'].contentDocumentId);
  await tryDeny(probe, PATHS.apex, map.files['MF-MODEL-SMALL-DENIED'].contentVersionId);
  await tryDeny(probe, PATHS.connect, map.files['MF-MODEL-REP-DENIED'].contentDocumentId);
  await rows.nth(2).getByRole('button', { name: 'Check delivery' }).click(); // bundled asset: not case-checked
  await idle(probe);
  // Requests made while opening REP over Connect: only the model itself (textures are embedded).
  await probe.getByLabel('Delivery path').selectOption({ label: PATHS.connect });
  const seen: string[] = [];
  const onReq = (r: { url: () => string }): void => {
    const u = r.url();
    seen.push(u.startsWith('blob:') ? 'blob:' : new URL(u).pathname.replace(/[A-Za-z0-9]{15,18}/g, '<id>'));
  };
  page.on('request', onReq);
  await rows.nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(probe.getByTestId('viewer-state')).toContainText('ready', { timeout: 120_000 });
  page.off('request', onReq);
  const ev = await probeEvidence(probe, 'smf14-evidence');
  const checks = ev.deliveryChecks as { label: string; path: string; outcome: string; detail: string; fixtureId: string | null }[];
  expect(checks.filter(c => c.label.endsWith('(bundled asset)') === false && c.label !== 'denial control' && c.path === 'connect-content' && c.outcome === 'delivered')).toHaveLength(2);
  expect(checks.filter(c => c.label === 'denial control' && c.outcome !== 'denied')).toEqual([]);
  const modelRequests = seen.filter(u => u !== 'blob:' && !u.includes('/assets/'));
  record(info, { browserVersion: browser.version(), case: 'BUDGET-03', persona: 'MF-TECH', checks, modelRequests,
    observed: 'see checks: SMALL/REP via Connect and SMF-10 Apex; denial controls; bundled asset path delivered without case check (reported as bypass)' });
  await ctx.close();
});

test('BUDGET-03 restricted: MF-CASE-001 model Files are denied on both paths', async ({ browser }, info) => {
  const map = ids();
  test.skip(!map, 'BLOCKED: private/smf14-model-files.json missing (stage 47)');
  if (!map) return;
  const ctx = await personaContext(browser, 'restricted' as Persona);
  const page = ctx.pages()[0];
  const probe = await start(page, info.project.name, map['MF-CASE-001']);
  await probe.getByRole('button', { name: 'List model Files on the case' }).click();
  await expect(probe.getByTestId('list-error')).toBeVisible({ timeout: 60_000 });
  for (const t of ['MF-MODEL-SMALL', 'MF-MODEL-REP']) {
    await tryDeny(probe, PATHS.connect, map.files[t].contentDocumentId);
    await tryDeny(probe, PATHS.apex, map.files[t].contentVersionId);
  }
  const ev = await probeEvidence(probe, 'smf14-evidence');
  const checks = ev.deliveryChecks as { outcome: string }[];
  expect(checks).toHaveLength(4);
  expect(checks.filter(c => c.outcome !== 'denied')).toEqual([]);
  record(info, { browserVersion: browser.version(), case: 'BUDGET-03', persona: 'MF-RESTRICTED', listError: ev.listError, checks });
  await ctx.close();
});

test('BUDGET-01/02 cloud row only (software WebGL — not device evidence): harness for both models', async ({ browser }, info) => {
  test.setTimeout(1_800_000);
  const map = ids();
  test.skip(!map, 'BLOCKED: private/smf14-model-files.json missing (stage 47)');
  if (!map) return;
  const ctx = await personaContext(browser, 'tech');
  const page = ctx.pages()[0];
  const probe = await start(page, info.project.name, map['MF-CASE-001']);
  await probe.getByRole('button', { name: 'List model Files on the case' }).click();
  await expect(probe.getByTestId('model-list')).toContainText('MF-MODEL-REP', { timeout: 60_000 });
  await probe.getByLabel('Delivery path').selectOption({ label: PATHS.connect });
  await probe.getByRole('button', { name: 'Run harness for all listed models' }).click();
  await expect(probe.getByTestId('busy')).toHaveCount(1);
  await idle(probe, 1_700_000);
  const ev = await probeEvidence(probe, 'smf14-evidence');
  record(info, { browserVersion: browser.version(), case: 'BUDGET-01/02', persona: 'MF-TECH', row: 'ENV-CLOUD (software-rendered)',
    caveat: 'SwiftShader software WebGL: never used for a device budget (BUDGET-04 excludes it automatically)', harness: ev.harness, budget: ev.budget });
  await ctx.close();
});
