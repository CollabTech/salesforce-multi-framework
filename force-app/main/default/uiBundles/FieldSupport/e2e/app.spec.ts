import { test, expect } from '@playwright/test';

// ENV-EMULATION-LOCALHOST only: the built bundle served statically with no Salesforce
// session. Proves the shell, routing and host-context capture work; it cannot prove
// HOST-01..03, which need a deployed app, real personas and real hosts.
test.describe('Field Support PoC shell (localhost, no org)', () => {
  test('launch check renders host context and reports the missing Salesforce session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Launch check' })).toBeVisible();
    await expect(page.getByTestId('host-context')).toContainText('origin: http://localhost');
    await expect(page.getByRole('alert')).toContainText('Could not read the Salesforce user');
  });

  // Deep-link reload is NOT checked here: the bundle uses relative asset URLs resolved
  // against the <base href> the Salesforce runtime injects, which a static localhost
  // server does not provide. Reload is part of the host test (HOST-01 device script).
  test('in-app navigation reaches the navigation check route', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Navigation check' }).first().click();
    await expect(page.getByTestId('route')).toHaveText('/launch/navigation');
    await page.getByRole('link', { name: 'Back to launch check' }).click();
    await expect(page.getByRole('heading', { name: 'Launch check' })).toBeVisible();
  });

  test('not found route shows 404', async ({ page }) => {
    await page.goto('/non-existent-route');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });
});
