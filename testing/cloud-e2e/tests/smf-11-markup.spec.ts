import { test, expect, type Browser, type Frame, type Page } from '@playwright/test';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { fixtureRecordId, latestVersionIds, markupVersionIds, openProbe } from './files-markup-helpers';

// SMF-11 MARK-01 (mouse), MARK-02, MARK-03, MARK-04 as real personas in ENV-DESKTOP-EDGE /
// ENV-CLOUD-CHROMIUM. Automation attests: shapes created by mouse, pan/zoom keeps page-space
// shapes, snapshot/export saved and associated, fresh-context reopen without web storage,
// conflict/no silent overwrite, failed save + retry, RESTRICTED denials, license gate state.
// It cannot attest: touch on physical Salesforce mobile, readability of callouts on a phone
// screen — HUMAN-ACTIONS (MARK-01 touch, MARK-02 mobile reopen).
// MF-IMAGE-001's inlet position comes from SMF_INLET_BOX="x,y,w,h" (image pixels, SMF-3 fixture
// manifest); without it the circle is drawn at the image centre and placement is not verified.

const LINK = /SMF-11 · Equipment markup in Salesforce Files/;
const HEADING = /Equipment markup in Salesforce Files/;
const FIXTURE_LINE = 'MF-MARKUP-001 check: image true red circle true arrow true label true';
const inlet = (process.env.SMF_INLET_BOX ?? '').split(',').map(Number);
const hasInlet = inlet.length === 4 && inlet.every(n => Number.isFinite(n));

test.describe.configure({ mode: 'serial' });

type App = Page | Frame;
interface Session {
  close: () => Promise<void>;
  page: Page;
  app: App;
}

async function open(browser: Browser, persona: Persona, caseId: string): Promise<Session> {
  const ctx = await personaContext(browser, persona);
  const { page, app } = await openProbe(ctx, LINK, HEADING);
  await app.getByLabel('Case record Id').fill(caseId);
  return { page, app, close: () => ctx.close() };
}

async function evidence(app: App): Promise<string> {
  await app.getByTestId('check-shapes').click().catch(() => undefined);
  return app.getByTestId('evidence').innerText();
}

function licenseBlocked(text: string): boolean {
  return text.includes('gate: BLOCKED-no-key');
}

/** Screen point for an image-pixel coordinate using the rendered image element's box. */
async function imagePoint(s: Session, px: number, py: number, natural: { w: number; h: number }) {
  const box = await s.app.locator('.tl-image').first().boundingBox();
  if (!box) throw new Error('image not rendered');
  return { x: box.x + (px / natural.w) * box.width, y: box.y + (py / natural.h) * box.height };
}

async function naturalSize(s: Session) {
  return s.app.locator('.tl-image').first().evaluate(el => {
    const img = el instanceof HTMLImageElement ? el : el.querySelector('img');
    return { w: img?.naturalWidth ?? 1, h: img?.naturalHeight ?? 1 };
  });
}

async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

async function focusCanvas(s: Session) {
  await s.app.getByTestId('markup-canvas').scrollIntoViewIfNeeded();
  const box = await s.app.locator('.tl-canvas').boundingBox();
  if (!box) throw new Error('canvas missing');
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
}

let caseId = '';

test.beforeAll(() => {
  caseId = fixtureRecordId('MF-CASE-001') ?? '';
});

test('MARK-01 TECH (mouse): red circle over the inlet on MF-IMAGE-001; pan/zoom keeps shapes; save r(n)', async ({ browser }, info) => {
  test.skip(!caseId, 'MF-CASE-001 mapping missing (SMF-3)');
  const s = await open(browser, 'tech', caseId);
  await s.app.getByTestId('list-images').click();
  await s.app.getByTestId('image-list').getByRole('radio', { name: /MF-IMAGE-001/ }).first().check();
  await s.app.getByTestId('start-new').click();
  await expect(s.app.locator('.tl-image').first()).toBeVisible({ timeout: 60_000 });
  const pre = await evidence(s.app);
  if (licenseBlocked(pre)) {
    record(info, { case: 'MARK-01', persona: 'MF-TECH', outcome: 'BLOCKED', reason: 'tldraw production license key absent at build (H5)', observed: pre.split('\n').find(l => l.startsWith('tldraw')) });
    await s.close();
    test.skip(true, 'license');
  }
  await focusCanvas(s);
  const natural = await naturalSize(s);
  const [ix, iy, iw, ih] = hasInlet ? inlet : [natural.w * 0.4, natural.h * 0.4, natural.w * 0.2, natural.h * 0.2];
  await s.page.keyboard.press('o');
  await s.app.getByTestId('style.color.red').click();
  await drag(s.page, await imagePoint(s, ix - 20, iy - 20, natural), await imagePoint(s, ix + iw + 20, iy + ih + 20, natural));
  await s.page.keyboard.press('Escape');
  const afterDraw = await evidence(s.app);
  expect(afterDraw).toContain('red circle true');
  await s.page.mouse.wheel(0, -300);
  await s.page.mouse.wheel(150, 80);
  const afterPan = await evidence(s.app);
  expect(afterPan.split('\n').find(l => l.startsWith('shapes:'))).toBe(afterDraw.split('\n').find(l => l.startsWith('shapes:')));
  await s.app.getByTestId('save').click();
  await expect(s.app.getByTestId('save-state')).toContainText('saved', { timeout: 90_000 });
  record(info, { case: 'MARK-01', persona: 'MF-TECH', browserVersion: browser.version(), inletPlacementVerified: hasInlet, observed: await evidence(s.app) });
  await s.close();
});

test('MARK-01/02 SUPPORT: reopen TECH markup, add arrow + "Inspect inlet", save; fresh context reopen restores all', async ({ browser }, info) => {
  test.skip(!caseId, 'MF-CASE-001 mapping missing (SMF-3)');
  const s = await open(browser, 'support', caseId);
  await s.app.getByTestId('reopen').click();
  await expect(s.app.locator('.tl-image').first()).toBeVisible({ timeout: 60_000 });
  await focusCanvas(s);
  const natural = await naturalSize(s);
  await s.page.keyboard.press('a');
  await drag(s.page, await imagePoint(s, natural.w * 0.8, natural.h * 0.15, natural), await imagePoint(s, natural.w * 0.62, natural.h * 0.4, natural));
  await s.page.keyboard.press('Escape');
  await s.page.keyboard.press('t');
  const t = await imagePoint(s, natural.w * 0.7, natural.h * 0.1, natural);
  await s.page.mouse.click(t.x, t.y);
  await s.page.waitForTimeout(500);
  await s.page.keyboard.type('Inspect inlet', { delay: 30 });
  await s.page.keyboard.press('Escape');
  await s.page.keyboard.press('Escape');
  expect(await evidence(s.app)).toContain(FIXTURE_LINE);
  await s.app.getByTestId('save').click();
  await expect(s.app.getByTestId('save-state')).toContainText('saved', { timeout: 90_000 });
  const saved = await evidence(s.app);
  record(info, { case: 'MARK-02', persona: 'MF-SUPPORT', browserVersion: browser.version(), observed: saved });
  await s.close();

  // Fresh context (new browser context = new session, empty storage), reopen as SUPPORT.
  const f = await open(browser, 'support', caseId);
  const storage = await f.app.evaluate(async () => ({ local: Object.keys(localStorage).filter(k => /tldraw/i.test(k)), idb: (await indexedDB.databases()).map(d => d.name).filter(n => /tldraw/i.test(n ?? '')) }));
  expect(storage).toEqual({ local: [], idb: [] });
  await f.app.getByTestId('reopen').click();
  await expect(f.app.getByTestId('export-readback')).toBeVisible({ timeout: 60_000 });
  await expect(f.app.locator('.tl-image').first()).toBeVisible({ timeout: 60_000 });
  const reopened = await evidence(f.app);
  expect(reopened).toContain(FIXTURE_LINE);
  record(info, { case: 'MARK-02', persona: 'MF-SUPPORT (fresh context)', browserVersion: browser.version(), observed: reopened, webStorageTldrawKeys: storage });
  await f.close();
});

test('MARK-03: concurrent TECH/SUPPORT saves conflict explicitly; failed save + retry writes one revision', async ({ browser }, info) => {
  test.skip(!caseId, 'MF-CASE-001 mapping missing (SMF-3)');
  const tech = await open(browser, 'tech', caseId);
  const support = await open(browser, 'support', caseId);
  for (const s of [tech, support]) {
    await s.app.getByTestId('reopen').click();
    await expect(s.app.locator('.tl-image').first()).toBeVisible({ timeout: 60_000 });
    await focusCanvas(s);
    await s.page.keyboard.press('r');
    const box = await s.app.locator('.tl-canvas').boundingBox();
    await drag(s.page, { x: box!.x + 60, y: box!.y + 60 }, { x: box!.x + 140, y: box!.y + 120 });
  }
  const before = markupVersionIds(caseId, 'snapshot').length;
  await tech.app.getByTestId('save').click();
  await expect(tech.app.getByTestId('save-state')).toContainText('saved', { timeout: 90_000 });
  await support.app.getByTestId('save').click();
  await expect(support.app.getByTestId('conflict')).toBeVisible({ timeout: 90_000 });
  expect(markupVersionIds(caseId, 'snapshot').length, 'conflicting save wrote nothing').toBe(before + 1);
  record(info, { case: 'MARK-03', persona: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(), observed: `conflict shown to SUPPORT: ${(await support.app.getByTestId('conflict').innerText()).split('\n')[0]}` });

  // Failure: SUPPORT goes offline during "save on top", then retries online.
  await support.page.context().setOffline(true);
  await support.app.getByTestId('save-on-top').click();
  await expect(support.app.getByTestId('save-error')).toBeVisible({ timeout: 90_000 });
  await support.page.context().setOffline(false);
  await support.app.getByTestId('retry-save').click();
  await expect(support.app.getByTestId('save-state')).toContainText('saved', { timeout: 90_000 });
  expect(markupVersionIds(caseId, 'snapshot').length, 'retry wrote exactly one more revision').toBe(before + 2);
  expect(markupVersionIds(caseId, 'export').length).toBeGreaterThanOrEqual(before + 2);
  record(info, { case: 'MARK-03', persona: 'MF-SUPPORT', browserVersion: browser.version(), observed: await evidence(support.app) });
  await tech.close();
  await support.close();
});

test('MARK-04: RESTRICTED cannot read markup, image, snapshot or export', async ({ browser }, info) => {
  test.skip(!caseId, 'MF-CASE-001 mapping missing (SMF-3)');
  const snapshots = markupVersionIds(caseId, 'snapshot');
  const exports = markupVersionIds(caseId, 'export');
  const markup = new Set([...snapshots, ...exports]);
  const [snapshot, exported] = [snapshots[0], exports[0]];
  const image = latestVersionIds(caseId).find(id => !markup.has(id));
  expect(snapshot && exported && image, 'saved markup + image exist (MARK-01..03)').toBeTruthy();
  const s = await open(browser, 'restricted', caseId);
  await s.app.getByTestId('reopen').click();
  await expect(s.app.getByTestId('markup-message')).toContainText('DENIED', { timeout: 60_000 });
  await s.close();
  const ctx = await personaContext(browser, 'restricted');
  const { app } = await openProbe(ctx, /SMF-10 · Case image in Salesforce Files/, /Case image in Salesforce Files/);
  for (const [label, id] of [['snapshot', snapshot], ['export', exported], ['image', image]] as const) {
    await app.getByLabel('ContentVersion Id to retrieve').fill(id!);
    await app.getByTestId('retrieve').click();
    await expect(app.getByTestId('retrieve-denied')).toBeVisible({ timeout: 60_000 });
    record(info, { case: 'MARK-04', persona: 'MF-RESTRICTED', browserVersion: browser.version(), observed: `${label}: DENIED` });
  }
  await ctx.close();
});
