import { expect, test } from '@playwright/test';

// SMF-9 — ENV-EMULATION-LOCALHOST exploratory with the probe's SIMULATED transport (no call,
// no RealtimeKit, no Salesforce, no device). Playwright context.setOffline toggles the browser's
// online state; the simulated client reacts like a call client. This checks only the recovery
// panel's detection/timing/duplicate/leave logic. Not evidence for REC-01..03.

test('REC-01 logic: three network loss/recovery runs produce three timed episodes', async ({ page, context }, info) => {
  await page.goto('/probes/recovery');
  await page.getByTestId('mode-simulated').click();
  await page.getByTestId('sim-join').click();
  await expect(page.getByTestId('sim-phase')).toHaveText('joined');
  await page.getByTestId('sim-camera').click();
  for (const run of [1, 2, 3]) {
    await page.getByTestId(`run-${run}`).click();
    await context.setOffline(true);
    await expect(page.getByTestId('recovery-state')).toContainText('socket=disconnected');
    await page.waitForTimeout(1000 * run);
    await context.setOffline(false);
    await expect(page.getByTestId('recovery-state')).toContainText('socket=connected', { timeout: 10_000 });
    await expect(page.getByTestId('recovery-state')).toContainText('remotes=1');
  }
  const episodes = (await page.getByTestId('episodes').textContent()) ?? '';
  const variabilityText = (await page.getByTestId('variability').textContent()) ?? '';
  info.annotations.push({ type: 'episodes', description: episodes }, { type: 'variability', description: variabilityText });
  const rows = episodes.split('\n').filter(l => l.startsWith('| network-loss'));
  expect(rows).toHaveLength(3);
  expect(episodes).not.toContain('NOT RECOVERED');
  expect(variabilityText).toContain('3/3 recovered');
});

test('REC-01/03 logic: duplicate participant flagged; leave ends local tracks; rejoin has no duplicate', async ({ page }, info) => {
  await page.goto('/probes/recovery');
  await page.getByTestId('mode-simulated').click();
  await page.getByTestId('sim-join').click();
  await page.getByTestId('sim-camera').click();
  await page.getByTestId('sim-duplicate').click();
  await expect(page.getByTestId('duplicate-alert')).toBeVisible();
  await page.getByTestId('sim-leave').click();
  await expect(page.getByTestId('last-leave')).toContainText('all ended=true');
  const lastLeave = (await page.getByTestId('last-leave').textContent()) ?? '';
  await page.getByTestId('sim-join').click();
  await expect(page.getByTestId('recovery-state')).toContainText('remotes=1');
  await expect(page.getByTestId('duplicate-alert')).toHaveCount(0);
  info.annotations.push({ type: 'last-leave', description: lastLeave });
});

test('REC-02 logic: hidden/visible is logged on the timeline', async ({ page }) => {
  await page.goto('/probes/recovery');
  await page.getByTestId('mode-simulated').click();
  await page.getByTestId('sim-join').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('timeline')).toContainText('hidden hidden');
  await expect(page.getByTestId('timeline')).toContainText('visible visible');
});
