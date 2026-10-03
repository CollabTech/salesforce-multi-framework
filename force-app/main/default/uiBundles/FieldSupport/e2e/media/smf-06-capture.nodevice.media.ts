import { expect, test } from '@playwright/test';

// SMF-6 — ENV-EMULATION-LOCALHOST exploratory: a machine with no camera/mic hardware
// (this container). The probe must report the real failure, not a fallback. Not host evidence.

test('CAP-02 no hardware: camera-only and mic-only report NotFoundError', async ({ page }) => {
  await page.goto('/probes/capture');
  await page.getByTestId('start-camera').click();
  await expect(page.getByTestId('failure-code')).toHaveText('NotFoundError');
  await page.getByTestId('start-mic').click();
  await expect(page.getByTestId('failure-code')).toHaveText('NotFoundError');
  await expect(page.getByTestId('track-table')).toContainText('No tracks.');
});
