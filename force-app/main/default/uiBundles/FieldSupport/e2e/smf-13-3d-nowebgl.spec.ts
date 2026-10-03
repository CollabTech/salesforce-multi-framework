import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

/** ENV-EMULATION-LOCALHOST only — localhost exploratory, NOT host evidence (see smf-13-3d.spec.ts). */
const RESULTS_DIR = process.env.SMF_RESULTS_DIR ?? 'test-results/smf-13';
const executablePath = process.env.PW_CHROMIUM_PATH;

test.use({ launchOptions: { executablePath, args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'] } });

test.describe('SMF-13 3D probe with WebGL disabled in the browser (localhost exploratory)', () => {
  test('3D-03 localhost: real WebGL unavailability shows the static fallback', async ({ page }) => {
    await page.goto('/probes/3d');
    await expect(page.getByTestId('static-fallback')).toBeVisible();
    await expect(page.getByTestId('status')).toHaveText('no-webgl');
    await expect(page.locator('canvas')).toHaveCount(0);
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, '3D-03-no-webgl.json'), (await page.getByTestId('smf13-evidence').textContent()) ?? '{}');
  });
});
