import { expect, test } from '@playwright/test';

// SMF-6 — ENV-EMULATION-LOCALHOST exploratory: permission denied, then granted and retried.
// Chromium launched with --deny-permission-prompts; Playwright grants permission mid-test to
// stand in for a user changing the setting. Not host evidence.

test('CAP-02 denied → NotAllowedError shown; grant then retry → capture succeeds', async ({ page, context }) => {
  await page.goto('/probes/capture');
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('failure-code')).toHaveText('NotAllowedError');
  await expect(page.getByTestId('track-table')).toContainText('No tracks.');

  await context.grantPermissions(['camera', 'microphone']);
  await page.getByTestId('start-both').click();
  await expect(page.getByTestId('ready-video')).toHaveText('live');
  await expect(page.getByTestId('ready-audio')).toHaveText('live');
  await expect(page.getByTestId('failure')).toHaveCount(0);
});
