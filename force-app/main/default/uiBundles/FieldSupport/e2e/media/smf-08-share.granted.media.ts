import { expect, test } from '@playwright/test';
import { observeTracks, observedTrackStates } from './helpers';

// SMF-8 — ENV-EMULATION-LOCALHOST exploratory. Chromium with --use-fake-ui-for-media-stream
// auto-accepts getDisplayMedia (no picker). Exercises the probe's LOCAL share test path
// (start/stop/restart, track lifecycle, screen-audio reporting) and host detection only.
// No call, no RealtimeKit, no Salesforce host. Not evidence for SHARE-01..03 rows.

test.beforeEach(async ({ page }) => {
  await observeTracks(page);
  await page.goto('/probes/share');
  await expect(page.getByRole('heading', { name: 'Screen share during the call' })).toBeVisible();
});

test('SHARE-01 local: start, stop, restart from clicks; tracks end on stop', async ({ page }) => {
  await expect(page.getByTestId('share-verdict')).toHaveText('api-present');
  await page.getByTestId('local-share-start').click();
  await expect(page.getByTestId('local-share-state')).toContainText('video video live');
  await expect.poll(() => page.evaluate(() => (document.querySelector('[data-testid=local-share-preview]') as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames), { timeout: 10_000 }).toBeGreaterThan(3);
  const first = await page.getByTestId('local-share-state').textContent();
  await page.getByTestId('local-share-stop').click();
  await expect(page.getByTestId('local-share-state')).toHaveText('not sharing');
  await page.getByTestId('local-share-start').click();
  await expect(page.getByTestId('local-share-state')).toContainText('video video live');
  await page.getByTestId('local-share-stop').click();
  const states = await observedTrackStates(page);
  test.info().annotations.push({ type: 'first-share', description: first ?? '' }, { type: 'observer', description: states.join(',') });
  expect(states.length).toBeGreaterThanOrEqual(2);
  expect(states.every(s => s.endsWith(':ended'))).toBe(true);
});

test('SHARE-03 local: screen audio requested is reported as captured or not, never assumed', async ({ page }) => {
  await page.getByTestId('share-audio-request').click();
  await page.getByTestId('local-share-start').click();
  await expect(page.getByTestId('local-share-state')).toContainText('video video live');
  const txt = (await page.getByTestId('local-share-state').textContent()) ?? '';
  test.info().annotations.push({ type: 'audio-result', description: txt });
  expect(txt).toMatch(/audio (audio live|requested, not offered\/selected)/);
  await page.getByTestId('local-share-stop').click();
});

test('SHARE-02 local: call controls stay disabled outside a call; fallback image not shown when API present', async ({ page }) => {
  await expect(page.getByTestId('share-start')).toBeDisabled();
  await expect(page.getByTestId('fallback-image')).toHaveCount(0);
});

test('diagnostic screen renders a changing marker', async ({ page }) => {
  await page.goto('/probes/diagnostic-screen');
  await expect(page).toHaveTitle('SMF Diagnostic Screen');
  const sample = (): Promise<string> => page.evaluate(() => (document.querySelector('[data-testid=diagnostic-canvas]') as HTMLCanvasElement).toDataURL().slice(-200));
  const a = await sample();
  await page.waitForTimeout(700);
  expect(await sample()).not.toBe(a);
});
