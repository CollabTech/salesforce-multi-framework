import { test, expect, type Browser, type Page } from '@playwright/test';
import { INLET, syntheticPumpPng } from './support/syntheticPng';

// ENV-EMULATION-LOCALHOST only (SMF-11). Built bundle served statically; MOCK Files transport
// (in-memory, localhost-only) stands in for Salesforce Files. Exercises: drawing the
// MF-MARKUP-001 annotations with mouse (and CDP touch), pan/zoom, snapshot + PNG export save,
// reopen in a FRESH browser context with no web storage (state carried only by the mock
// "server" export), failed save/retry, and stale-base conflict. Not Salesforce/persona/device
// evidence. The image is a synthetic stand-in generated here, not the SMF-3 asset.

const IMAGE_VERSION = '068' + 'MOCKIMG00001AAA';
const IMAGE_DOC = '069' + 'MOCKIMG00001AAA';
const CASE = '500' + 'MOCKCASE0001AAA';

function imageSeed() {
  const png = syntheticPumpPng();
  return [
    {
      type: 'image/png',
      base64: png.toString('base64'),
      info: {
        contentDocumentId: IMAGE_DOC,
        latestVersionId: IMAGE_VERSION,
        linkedEntityId: CASE,
        title: 'MF-IMAGE-001 (synthetic stand-in)',
        fileExtension: 'png',
        fileType: 'PNG',
        contentSize: png.length,
        versionNumber: '1',
        description: null,
        reasonForChange: null,
        checksum: null,
        createdDate: new Date().toISOString(),
        shareType: 'V',
        visibility: 'AllUsers',
        publicLinkCount: 0,
      },
    },
  ];
}

type Seed = unknown[];

async function openProbe(page: Page, seed: Seed, query = ''): Promise<string[]> {
  const external: string[] = [];
  page.on('request', r => {
    const host = new URL(r.url()).hostname;
    if (!['localhost', '127.0.0.1'].includes(host) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(host);
  });
  await page.addInitScript(s => {
    (window as unknown as { __SMF_MOCK_SEED__: unknown }).__SMF_MOCK_SEED__ = s;
  }, seed);
  await page.goto(`/probes/markup?transport=mock${query}`);
  await expect(page.getByTestId('mock-banner')).toBeVisible();
  return external;
}

async function waitForEditor(page: Page, minShapes: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__SMF_EDITOR__?.getCurrentPageShapes().length ?? 0), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(minShapes);
}

async function startNewMarkup(page: Page): Promise<void> {
  await page.getByTestId('list-images').click();
  await page.getByTestId('image-list').getByRole('radio').first().check();
  await page.getByTestId('start-new').click();
  await waitForEditor(page, 1);
}

/** Screen point for an image-pixel coordinate (image sits at page origin). */
async function screenPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([px, py]) => window.__SMF_EDITOR__!.pageToViewport({ x: px, y: py }), [x, y] as const).then(async p => {
    const box = await page.locator('.tl-container').first().boundingBox();
    return { x: (box?.x ?? 0) + p.x, y: (box?.y ?? 0) + p.y };
  });
}

async function focusCanvas(page: Page): Promise<void> {
  await page.getByTestId('markup-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('.tl-canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

async function drawFixtureAnnotations(page: Page): Promise<void> {
  // TECH: red ellipse over the inlet (mouse).
  await focusCanvas(page); // scrolls first, so screen points below are current
  const c1 = await screenPoint(page, INLET.x - 20, INLET.y - 20);
  const c2 = await screenPoint(page, INLET.x + INLET.w + 20, INLET.y + INLET.h + 20);
  await page.keyboard.press('o');
  await page.getByTestId('style.color.red').click();
  await drag(page, c1, c2);
  // SUPPORT: arrow pointing at the inlet, then the text label.
  await page.keyboard.press('Escape');
  await page.keyboard.press('a');
  await drag(page, await screenPoint(page, 450, 120), await screenPoint(page, INLET.x + INLET.w + 25, INLET.y + 40));
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  const t = await screenPoint(page, 460, 90);
  await page.mouse.click(t.x, t.y);
  await expect.poll(() => page.evaluate(() => window.__SMF_EDITOR__!.getEditingShapeId())).not.toBeNull();
  await page.waitForTimeout(200);
  await page.keyboard.type('Inspect inlet', { delay: 20 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

async function summary(page: Page): Promise<string> {
  await page.getByTestId('check-shapes').click();
  return (await page.getByTestId('evidence').innerText()).split('\n').find(l => l.startsWith('shapes:')) ?? '';
}

async function freshContextPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:5175' });
  return ctx.newPage();
}

test.describe('SMF-11 markup probe (localhost, mock transport)', () => {
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('MARK-01/02: draw circle, arrow and label; save; reopen in a fresh context without web storage', async ({ page, browser }) => {
    const external = await openProbe(page, imageSeed());
    await startNewMarkup(page);
    await drawFixtureAnnotations(page);
    const before = await summary(page);
    // The red circle covers the inlet rectangle (image pixels = page units; image at origin).
    const ellipse = await page.evaluate(() => {
      const ed = window.__SMF_EDITOR__!;
      const geo = ed.getCurrentPageShapes().find(s => s.type === 'geo')!;
      const b = ed.getShapePageBounds(geo)!;
      return { x: b.x, y: b.y, w: b.w, h: b.h };
    });
    expect(ellipse.x).toBeLessThan(INLET.x);
    expect(ellipse.y).toBeLessThan(INLET.y);
    expect(ellipse.x + ellipse.w).toBeGreaterThan(INLET.x + INLET.w);
    expect(ellipse.y + ellipse.h).toBeGreaterThan(INLET.y + INLET.h);
    await expect(page.getByTestId('evidence')).toContainText('MF-MARKUP-001 check: image true red circle true arrow true label true');

    // Pan/zoom: camera changes, page-space shapes do not.
    const cam0 = await page.evaluate(() => window.__SMF_EDITOR__!.getCamera());
    await page.mouse.move(600, 500);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await page.mouse.wheel(200, 100);
    const cam1 = await page.evaluate(() => window.__SMF_EDITOR__!.getCamera());
    expect(cam1).not.toEqual(cam0);
    expect(await summary(page)).toBe(before);

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-state')).toContainText('saved · r1', { timeout: 30_000 });
    await expect(page.getByTestId('export-readback').locator('img')).toBeVisible();
    const exportSize = await page.getByTestId('export-readback').locator('img').evaluate(i => (i as HTMLImageElement).naturalWidth);
    expect(exportSize).toBeGreaterThan(100);

    const storageA = await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      idb: (await indexedDB.databases()).map(d => d.name),
    }));
    expect(storageA.idb.filter(n => /tldraw/i.test(n ?? ''))).toEqual([]);
    const snapshotJson = await page.evaluate(async () => {
      const t = window.__SMF_MOCK_FILES__!;
      const files = await t.listCaseFiles('500' + 'MOCKCASE0001AAA');
      const snap = files.find(f => (f.description ?? '').includes('kind=snapshot'))!;
      return (await t.fetchVersionData(snap.latestVersionId)).text();
    });
    expect(snapshotJson).not.toMatch(/"(data|blob):/);
    expect(snapshotJson).toContain('asset:sfcv/');
    const serverState = await page.evaluate(() => window.__SMF_MOCK_FILES__!.exportState());

    // Fresh context: empty storage; only the mock "server" state is carried over.
    const page2 = await freshContextPage(browser);
    await openProbe(page2, serverState as Seed);
    const storageB = await page2.evaluate(async () => ({ local: Object.keys(localStorage).length, idb: (await indexedDB.databases()).length }));
    expect(storageB).toEqual({ local: 0, idb: 0 });
    await page2.getByTestId('reopen').click();
    await waitForEditor(page2, 4);
    expect(await summary(page2)).toBe(before);
    await expect(page2.getByTestId('evidence')).toContainText('base revision: r1');
    await expect
      .poll(() => page2.locator('.tl-image').first().evaluate(el => (el instanceof HTMLImageElement ? el.naturalWidth : (el.querySelector('img')?.naturalWidth ?? 0))), { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(external, 'no CDN or other external requests (tldraw assets self-hosted)').toEqual([]);
    await page2.context().close();
  });

  test('MARK-01 touch: an ellipse drawn with CDP touch events', async ({ page }) => {
    await openProbe(page, imageSeed());
    await startNewMarkup(page);
    await focusCanvas(page);
    await page.keyboard.press('o');
    const a = await screenPoint(page, 300, 200);
    const b = await screenPoint(page, 420, 300);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__SMF_EDITOR__!.getCurrentPageShapes().filter(s => s.type === 'geo').length)).toBe(1);
  });

  test('MARK-03: failed save then retry writes one revision', async ({ page }) => {
    await openProbe(page, imageSeed(), '&faults=upload-fail-once');
    await startNewMarkup(page);
    await drawFixtureAnnotations(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-error')).toContainText('injected mock fault', { timeout: 30_000 });
    await page.getByTestId('retry-save').click();
    await expect(page.getByTestId('save-state')).toContainText('saved · r1', { timeout: 30_000 });
    const snapshots = await page.evaluate(async () =>
      (await window.__SMF_MOCK_FILES__!.listCaseFiles('500' + 'MOCKCASE0001AAA')).filter(f => (f.description ?? '').includes('kind=snapshot')).length
    );
    expect(snapshots).toBe(1);
  });

  test('MARK-03: concurrent save from another session is a conflict, not an overwrite', async ({ page }) => {
    await openProbe(page, imageSeed());
    await startNewMarkup(page);
    await drawFixtureAnnotations(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-state')).toContainText('saved · r1', { timeout: 30_000 });
    // Another session saves r2 on top of r1.
    await page.evaluate(async () => {
      const api = window.__SMF_MARKUP_API__!;
      const r1 = await api.latest('500' + 'MOCKCASE0001AAA');
      await api.save({
        caseId: '500' + 'MOCKCASE0001AAA',
        baseSnapshotVersionId: r1!.snapshotVersionId,
        saveKey: 'other-session-0001',
        imageVersionId: r1!.imageVersionId,
        snapshotJson: '{"format":"smf11-tldraw-document@1","imageVersionId":"x","document":{}}',
        exportPng: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      });
    });
    await page.keyboard.press('r');
    await drag(page, await screenPoint(page, 600, 400), await screenPoint(page, 700, 480));
    await page.getByTestId('save').click();
    await expect(page.getByTestId('conflict')).toContainText('Conflict: revision r2');
    const count = async () =>
      page.evaluate(async () => (await window.__SMF_MOCK_FILES__!.listCaseFiles('500' + 'MOCKCASE0001AAA')).filter(f => (f.description ?? '').includes('kind=snapshot')).length);
    expect(await count()).toBe(2);
    await page.getByTestId('save-on-top').click();
    await expect(page.getByTestId('save-state')).toContainText('saved · r3', { timeout: 30_000 });
    expect(await count()).toBe(3);
  });
});
