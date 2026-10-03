import { expect, test } from '@playwright/test';

// SMF-8 — ENV-EMULATION-LOCALHOST exploratory. Not evidence for SHARE-02.
// Finding (2026-10-03 run): Chromium 141 with --deny-permission-prompts does NOT auto-deny the
// screen picker — getDisplayMedia stays pending. The first test records that; the second
// STUBS getDisplayMedia to reject with NotAllowedError (what a cancelled/denied picker returns)
// to check the probe's reporting and fallback.

test('harness: --deny-permission-prompts leaves getDisplayMedia pending (no picker in headless)', async ({ page }) => {
  await page.goto('/probes/share');
  await page.getByTestId('local-share-start').click();
  await page.waitForTimeout(5000);
  const failure = await page.getByTestId('share-failure-code').count();
  const state = await page.getByTestId('local-share-state').textContent();
  test.info().annotations.push({ type: 'after-5s', description: `failure shown=${failure > 0}; state=${state}` });
  expect(state).toBe('not sharing');
});

test('SHARE-02 local (stubbed rejection): cancelled/denied → CANCELLED_OR_DENIED + fallback image', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException('Permission denied by user', 'NotAllowedError'));
  });
  await page.goto('/probes/share');
  await page.getByTestId('local-share-start').click();
  await expect(page.getByTestId('share-failure-code')).toHaveText('CANCELLED_OR_DENIED');
  await expect(page.getByTestId('fallback-image')).toBeVisible();
  await expect(page.getByTestId('local-share-state')).toHaveText('not sharing');
});

test('SHARE-02 local (stubbed missing API): unsupported host verdict + fallback image', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: undefined, configurable: true });
  });
  await page.goto('/probes/share');
  await expect(page.getByTestId('share-verdict')).toHaveText('unsupported-api');
  await expect(page.getByTestId('fallback-image')).toBeVisible();
  await page.getByTestId('local-share-start').click();
  await expect(page.getByTestId('share-failure-code')).toHaveText('NOT_SUPPORTED');
});
