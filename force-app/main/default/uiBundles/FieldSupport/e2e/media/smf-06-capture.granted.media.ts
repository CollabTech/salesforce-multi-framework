import { expect, test } from '@playwright/test';
import { observeTracks, observedTrackStates } from './helpers';

// SMF-6 — ENV-EMULATION-LOCALHOST exploratory (Chromium fake devices, prompts auto-accepted).
// Not host evidence: no Salesforce runtime, no real camera/mic, no persona.

test.beforeEach(async ({ page }) => {
  await observeTracks(page);
  await page.goto('/probes/capture');
  await expect(page.getByRole('heading', { name: 'Camera and microphone capture' })).toBeVisible();
});

test('CAP-01 camera only: one live video track and preview frames advance', async ({ page }) => {
  await page.getByTestId('start-camera').click();
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await expect(page.getByTestId('track-audio')).toHaveCount(0);
  await expect.poll(async () => Number((await page.getByTestId('frames').textContent())?.match(/\d+/)?.[0] ?? 0), { timeout: 10_000 }).toBeGreaterThan(5);
});

test('CAP-01 mic only: one live audio track and the level meter moves', async ({ page }) => {
  await page.getByTestId('start-mic').click();
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  await expect(page.getByTestId('track-video')).toHaveCount(0);
  await expect.poll(async () => Number((await page.getByTestId('mic-peak').textContent())?.match(/[\d.]+/)?.[0] ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
});

test('CAP-01 combined: video + audio live, both show activity', async ({ page }) => {
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  await expect.poll(async () => Number((await page.getByTestId('frames').textContent())?.match(/\d+/)?.[0] ?? 0), { timeout: 10_000 }).toBeGreaterThan(5);
  await expect.poll(async () => Number((await page.getByTestId('mic-peak').textContent())?.match(/[\d.]+/)?.[0] ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  test.info().annotations.push(
    { type: 'measured', description: (await page.getByTestId('frames').textContent()) ?? '' },
    { type: 'measured', description: (await page.getByTestId('mic-peak').textContent()) ?? '' },
    { type: 'tracks', description: (await page.getByTestId('track-table').textContent()) ?? '' },
  );
});

test('CAP-02 simulated unavailable camera and mic report OverconstrainedError; live capture unaffected', async ({ page }) => {
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await page.getByTestId('sim-camera').click();
  await expect(page.getByTestId('failure-code')).toHaveText('OverconstrainedError');
  await page.getByTestId('sim-mic').click();
  await expect(page.getByTestId('failure-code')).toHaveText('OverconstrainedError');
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
});

test('CAP-02 switch microphone while capturing: old track ends, new track live', async ({ page }) => {
  await page.getByTestId('start-mic').click();
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  const before = await page.getByTestId('track-audio').locator('td').nth(1).textContent();
  await page.getByTestId('mic-select').click();
  const options = page.getByRole('option');
  const count = await options.count();
  test.skip(count < 2, `only ${count} microphone exposed`);
  // pick an option whose label differs from the current track
  for (let i = 0; i < count; i += 1) {
    if ((await options.nth(i).textContent()) !== before) {
      await options.nth(i).click();
      break;
    }
  }
  await expect(page.getByTestId('diagnostics')).toContainText('switched audio');
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  await expect(page.getByTestId('track-audio').locator('td').nth(1)).not.toHaveText(before ?? '');
  const states = await observedTrackStates(page);
  expect(states.filter(s => s === 'audio:ended')).toHaveLength(1);
});

test('CAP-03 leave (unmount) stops every track; independent observer confirms', async ({ page }) => {
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await page.getByTestId('leave').click();
  await expect(page.getByRole('heading', { name: 'Capability probes' })).toBeVisible();
  const states = await observedTrackStates(page);
  expect(states.length).toBeGreaterThanOrEqual(2);
  expect(states.every(s => s.endsWith(':ended'))).toBe(true);
  // the probe's own record, read after returning
  await page.getByRole('link', { name: /SMF-6/ }).click();
  await expect(page.getByTestId('previous-leave')).toContainText('unmount');
  await expect(page.getByTestId('previous-leave')).toContainText('all ended: true');
});

test('CAP-03 stop button ends every track', async ({ page }) => {
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  await page.getByTestId('stop-all').click();
  await expect(page.getByTestId('track-table')).toContainText('No tracks.');
  const states = await observedTrackStates(page);
  expect(states.every(s => s.endsWith(':ended'))).toBe(true);
});

test('diagnostics block carries policy observations', async ({ page }) => {
  await expect(page.getByTestId('diagnostics')).toContainText('secure context: true');
  await expect(page.getByTestId('diagnostics')).toContainText('framed: false');
  await expect(page.getByTestId('diagnostics')).toContainText('policy API:');
});
