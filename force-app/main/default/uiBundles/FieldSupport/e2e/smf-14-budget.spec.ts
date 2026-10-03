import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * ENV-EMULATION-LOCALHOST only — localhost exploratory, NOT host evidence. There is no org:
 * the SMF-10 Apex REST and Connect file-content endpoints are STUBBED by Playwright routes that
 * serve the generated GLBs and answer 404 for the denial controls. This exercises the probe's
 * real delivery code (sdk.fetch, SMF-10 transport, GLB checks), the harness and the budget
 * logic; it proves nothing about Salesforce sharing, Apex limits or device performance.
 * WebGL is SwiftShader (software). Results go to $SMF_RESULTS_DIR (default test-results/smf-14).
 */
const RESULTS_DIR = process.env.SMF_RESULTS_DIR ?? 'test-results/smf-14';
const MODELS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../testing/fixtures/models');
test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, viewport: { width: 1280, height: 900 } });

// Synthetic localhost-only identifiers (not Salesforce Ids).
const IDS = {
  case1: 'LCLCASE00000000001',
  case2: 'LCLCASE00000000002',
  small: { doc: 'LCLDOCSMALL0000001', ver: 'LCLVERSMALL0000001', file: 'MF-MODEL-SMALL.glb' },
  rep: { doc: 'LCLDOCREP000000001', ver: 'LCLVERREP000000001', file: 'MF-MODEL-REP.glb' },
  denied: { doc: 'LCLDOCDENIED000001', ver: 'LCLVERDENIED000001' },
};
const glb = (f: string): Buffer => readFileSync(join(MODELS_DIR, f));
const info = (m: typeof IDS.small, title: string) => ({
  contentDocumentId: m.doc, latestVersionId: m.ver, linkedEntityId: IDS.case1, title, fileExtension: 'glb', fileType: 'UNKNOWN',
  contentSize: glb(m.file).length, versionNumber: '1', description: null, reasonForChange: null, checksum: null, createdDate: null,
  shareType: 'I', visibility: 'AllUsers', publicLinkCount: 0,
});

let browserVersion = 'unknown';
const requests: string[] = [];

async function stubSalesforce(page: Page): Promise<void> {
  const notFound = (route: Route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found or no access.' }) });
  await page.route('**/services/data/*/ui-api/session/csrf', r => r.fulfill({ json: { csrfToken: 'localhost-stub' } }));
  await page.route('**/services/apexrest/smf10/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/cases/${IDS.case1}/files`)) {
      return route.fulfill({ json: { success: true, files: [info(IDS.small, 'MF-MODEL-SMALL'), info(IDS.rep, 'MF-MODEL-REP')] } });
    }
    for (const m of [IDS.small, IDS.rep]) {
      if (url.pathname.endsWith(`/versions/${m.ver}/data`)) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glb(m.file) });
    }
    return notFound(route);
  });
  await page.route('**/services/data/*/connect/files/*/content', route => {
    const url = new URL(route.request().url());
    for (const m of [IDS.small, IDS.rep]) {
      if (url.pathname.includes(`/files/${m.doc}/`)) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glb(m.file) });
    }
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify([{ errorCode: 'INSUFFICIENT_ACCESS', message: 'stub' }]) });
  });
  page.on('request', r => requests.push(`${r.method()} ${new URL(r.url()).pathname.replace(/[A-Za-z0-9]{18}/g, '<id>')}${r.url().startsWith('blob:') ? ' (blob)' : ''}`));
}

async function evidence(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('smf14-evidence').textContent()) ?? '{}') as Record<string, unknown>;
}
function save(name: string, data: unknown): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, name), JSON.stringify({ browserVersion, ...(data as object) }, null, 2));
}
async function idle(page: Page, timeout = 60_000): Promise<void> {
  await expect(page.getByTestId('busy')).toHaveCount(0, { timeout });
}
/** Waits until the probe is idle, printing new harness log lines as progress. */
async function idleWithProgress(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let seen = 0;
  while (Date.now() < deadline) {
    const log = ((await evidence(page)).log as { t: number; msg: string }[]) ?? [];
    for (const l of log.slice(seen)) console.log(`[probe +${l.t} ms] ${l.msg}`);
    seen = log.length;
    if ((await page.getByTestId('busy').count()) === 0) return;
    await page.waitForTimeout(5_000);
  }
  throw new Error('harness did not finish in time');
}
async function setup(page: Page): Promise<void> {
  await stubSalesforce(page);
  await page.goto(`/probes/3d-budget?caseId=${IDS.case1}`);
  await page.getByLabel('Environment row').selectOption('ENV-EMULATION-LOCALHOST');
  await page.getByLabel(/Device \/ browser/).fill(`headless Chromium ${browserVersion} (SwiftShader), Linux container`);
  await page.getByRole('button', { name: 'List model Files on the case' }).click();
  await expect(page.getByTestId('model-list')).toContainText('MF-MODEL-REP');
}

test.beforeEach(({ browser }) => {
  browserVersion = browser.version();
  requests.length = 0;
});

test('BUDGET-03 localhost: delivery over both user-context paths, denial controls, bypass report', async ({ page }) => {
  await setup(page);
  const rows = page.getByTestId('model-list').locator('li');
  for (const pathLabel of ['Connect REST file content (user context)', 'SMF-10 Apex REST (user context, with sharing)']) {
    await page.getByLabel('Delivery path').selectOption({ label: pathLabel });
    for (const i of [0, 1]) {
      await rows.nth(i).getByRole('button', { name: 'Check delivery' }).click();
      await idle(page);
    }
    const denyId = pathLabel.startsWith('Connect') ? IDS.denied.doc : IDS.denied.ver;
    await page.getByLabel(/Id expected to be denied/).fill(denyId);
    await page.getByRole('button', { name: 'Try fetch (expect denial)' }).click();
    await idle(page);
  }
  await rows.nth(2).getByRole('button', { name: 'Check delivery' }).click();
  await idle(page);
  // Open REP once and record every request made while loading (textures must not be fetched).
  requests.length = 0;
  await rows.nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByTestId('viewer-state')).toContainText('ready', { timeout: 60_000 });
  const loadRequests = [...requests];
  // Denied case listing (MF-CASE-002 control).
  await page.getByLabel(/Case Id/).fill(IDS.case2);
  await page.getByRole('button', { name: 'List model Files on the case' }).click();
  await expect(page.getByTestId('list-error')).toBeVisible();
  const ev = await evidence(page);
  const checks = ev.deliveryChecks as { label: string; path: string; outcome: string; fixtureId: string | null }[];
  expect(checks.filter(c => c.outcome === 'delivered' && c.fixtureId).length).toBe(5);
  expect(checks.filter(c => c.outcome === 'denied').length).toBe(2);
  // Only the one model request (current path: SMF-10 Apex) and in-page blob: decodes are allowed.
  expect(loadRequests.filter(r => !/\/smf10\/v1\/versions\/<id>\/data$|\/connect\/files\/<id>\/content$/.test(r) && !r.includes('(blob)'))).toEqual([]);
  expect(loadRequests.filter(r => !r.includes('(blob)'))).toHaveLength(1);
  save('BUDGET-03.json', { loadRequests, evidence: ev });
});

test('BUDGET-01/02 localhost: harness (5 open/close + 60 s) for both models, orientation and foreground events', async ({ page, context }) => {
  test.setTimeout(1_800_000);
  await setup(page);
  await page.getByLabel('Delivery path').selectOption({ label: 'Connect REST file content (user context)' });
  await page.getByRole('button', { name: 'Run harness for all listed models' }).click();
  await expect(page.getByTestId('busy')).toHaveCount(1);
  await idleWithProgress(page, 1_500_000);
  // BUDGET-02 session checks on the open REP model: viewport rotation and background/foreground.
  const rows = page.getByTestId('model-list').locator('li');
  await rows.nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByTestId('viewer-state')).toContainText('ready', { timeout: 60_000 });
  await page.setViewportSize({ width: 600, height: 1000 });
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1280, height: 900 });
  const other = await context.newPage();
  await other.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => undefined);
  await other.waitForTimeout(2000);
  await other.close();
  await page.bringToFront();
  await page.waitForTimeout(4000);
  const ev = await evidence(page);
  const harness = ev.harness as { label: string; cycles: { ok: boolean }[]; protocol: { ok: boolean } }[];
  expect(harness).toHaveLength(2);
  for (const h of harness) {
    expect(h.cycles.filter(c => c.ok)).toHaveLength(5);
    expect(h.protocol.ok).toBe(true);
  }
  save('BUDGET-01-02.json', ev);
});
