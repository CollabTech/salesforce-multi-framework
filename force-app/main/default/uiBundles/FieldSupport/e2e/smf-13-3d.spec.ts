import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * ENV-EMULATION-LOCALHOST only — localhost exploratory, NOT host evidence. Headless Chromium
 * renders WebGL in software (SwiftShader), so the timings and fps below say nothing about any
 * desktop or mobile device. Required host rows are run by a human (docs/test-scripts/SMF-13-3D.md).
 * Results are written to $SMF_RESULTS_DIR (default: test-results/smf-13) for the evidence records.
 */
const RESULTS_DIR = process.env.SMF_RESULTS_DIR ?? 'test-results/smf-13';
const executablePath = process.env.PW_CHROMIUM_PATH;
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

let browserVersion = 'unknown';
test.beforeEach(({ browser }) => {
  browserVersion = browser.version(); // the real engine version; the UA string is Playwright's device descriptor
});

function save(name: string, data: unknown): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, name), JSON.stringify({ browserVersion, ...(data as object) }, null, 2));
}

async function evidence(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('smf13-evidence').textContent()) ?? '{}') as Record<string, unknown>;
}

async function waitReady(page: Page): Promise<void> {
  await expect(page.getByTestId('status')).toHaveText('ready', { timeout: 30_000 });
}

test.use({ launchOptions: { executablePath, args: SWIFTSHADER }, viewport: { width: 1280, height: 800 } });

test.describe('SMF-13 3D probe (localhost exploratory, software WebGL)', () => {
  test('3D-01 localhost: load, orbit, zoom, select, reset, resize', async ({ page }) => {
    await page.goto('/probes/3d');
    await waitReady(page);
    const canvas = page.locator('[data-testid="viewer-host"] canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Orbit (drag) and zoom (wheel) with the mouse.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy + 40, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(300);

    // Select by tapping parts: sweep a few points until a part is hit.
    let hit = false;
    for (const [dx, dy] of [[0, 0], [-0.15, 0], [0.15, 0], [-0.25, 0.05], [0.2, -0.05]]) {
      await page.mouse.click(cx + dx * box.width, cy + dy * box.height);
      if (!(await page.getByTestId('selected-part').textContent())?.includes('none')) {
        hit = true;
        break;
      }
    }
    const selectedByPointer = await page.getByTestId('selected-part').textContent();
    await expect(page.getByTestId('selected-label')).toBeVisible();

    // Select from the accessible part list, then reset.
    await page.getByRole('button', { name: 'Impeller' }).click();
    await expect(page.getByTestId('selected-part')).toContainText('MF-PART-IMPELLER');
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(page.getByTestId('selected-part')).toContainText('none');

    // Resize: portrait-like and back (stands in for rotation; real rotation is a device step).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    const ev = await evidence(page);
    const log = (ev.log as { msg: string }[]).map(l => l.msg);
    expect(log.some(m => m.startsWith('resize 3'))).toBe(true);
    save('3D-01.json', { pointerSelectionHit: hit, selectedByPointer, evidence: ev });
  });

  test('3D-01 localhost: touch tap selects a part (hasTouch context)', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto('/probes/3d');
    await waitReady(page);
    const box = await page.locator('[data-testid="viewer-host"] canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    let selected = 'none';
    for (const [dx, dy] of [[0, 0], [-0.15, 0], [0.15, 0], [-0.25, 0.05], [0.2, -0.05], [0, 0.1]]) {
      await page.touchscreen.tap(box.x + box.width * (0.5 + dx), box.y + box.height * (0.5 + dy));
      selected = (await page.getByTestId('selected-part').textContent()) ?? 'none';
      if (!selected.includes('none')) break;
    }
    const ev = await evidence(page);
    save('3D-01-touch.json', { selected, evidence: ev });
    expect(selected).not.toContain('none');
    await ctx.close();
  });

  test('3D-02 localhost: 60 s scripted protocol', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/probes/3d');
    await waitReady(page);
    await page.getByRole('button', { name: 'Run 60 s protocol' }).click();
    await expect(page.getByTestId('judgement')).toBeVisible({ timeout: 120_000 });
    const ev = await evidence(page);
    save('3D-02.json', ev);
    expect((ev.protocol as { frames: number }).frames).toBeGreaterThan(0);
  });

  test('3D-03 localhost: missing model, context loss/restore, unmount/remount, simulated no WebGL', async ({ page }) => {
    await page.goto('/probes/3d');
    await waitReady(page);
    const steps: Record<string, unknown> = {};

    await page.getByRole('button', { name: 'Load missing model' }).click();
    await expect(page.getByTestId('status')).toHaveText('error');
    await expect(page.getByTestId('static-fallback')).toBeVisible();
    await expect(page.getByRole('img', { name: /Static rendering of synthetic pump/ })).toBeVisible();
    steps.missing = (await evidence(page)).error;
    await page.getByRole('button', { name: 'Retry loading MF-MODEL-SMALL' }).click();
    await waitReady(page);

    await page.getByRole('button', { name: 'Lose graphics context' }).click();
    await expect(page.getByTestId('status')).toHaveText('context-lost');
    await expect(page.getByTestId('static-fallback')).toBeVisible();
    await page.getByRole('button', { name: 'Restore graphics context' }).click();
    await waitReady(page);
    steps.afterRestore = (await evidence(page)).log;

    await page.getByRole('button', { name: 'Unmount 3D view' }).click();
    await expect(page.getByTestId('status')).toHaveText('unmounted');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Remount 3D view' }).first().click();
    await waitReady(page);
    await expect(page.locator('canvas')).toHaveCount(1);

    await page.getByRole('button', { name: 'Simulate no WebGL' }).click();
    await expect(page.getByTestId('status')).toHaveText('no-webgl');
    await expect(page.getByTestId('static-fallback')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    const ev = await evidence(page);
    const disposals = ev.disposals as { afterResourceDispose: { geometries: number; textures: number } }[];
    expect(disposals.length).toBeGreaterThanOrEqual(2);
    for (const d of disposals) expect(d.afterResourceDispose.geometries).toBe(0);
    save('3D-03.json', { steps, evidence: ev });
  });
});
