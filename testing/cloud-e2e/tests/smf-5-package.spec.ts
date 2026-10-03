import { test, expect } from '@playwright/test';
import { record } from './record';
import { appFrame, setSubscriberAppAccess, subscriberContext, subscriberDisplayName, type Persona } from './smf-5-subscriber';

// SMF-5 PKG-01..03 against the INSTALLED package in smf-install-test (cloud desktop rows:
// ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM is a separate, non-substitute row).
// Automation attests: app opens from the installed package for the persona's own session,
// correct user, package marker version, denial without FieldSupport_Access, restore.
// Automation does NOT attest: Salesforce mobile app behaviour (physical device, human-only),
// or anything about the package operations themselves (stages 60/61/64 reports do that).
const EXPECT = process.env.SMF_PKG_EXPECT === 'v2' ? 'v2' : 'v1';
const NUMBER: Record<string, string> = { v1: '1.0.0', v2: '1.1.0' };

for (const persona of ['tech', 'support'] as Persona[]) {
  const caseId = EXPECT === 'v1' ? 'PKG-01' : 'PKG-02';
  test(`${caseId} ${persona}: installed app launches for the non-admin persona and serves marker ${EXPECT}`, async ({ browser }, info) => {
    const expectedName = subscriberDisplayName(persona);
    const ctx = await subscriberContext(browser, persona);
    const page = ctx.pages()[0];
    const t0 = Date.now();
    let app = await appFrame(page);
    await expect(app.getByRole('heading', { name: 'Launch check' })).toBeVisible({ timeout: 60_000 });
    const launchMs = Date.now() - t0;
    await expect(app.getByTestId('user-name')).toHaveText(expectedName);
    await app.getByRole('link', { name: 'Capability probes' }).first().click();
    await app.getByRole('link', { name: /Package version marker/ }).click();
    await expect(app.getByTestId('package-marker')).toHaveText(EXPECT, { timeout: 30_000 });
    await expect(app.getByTestId('package-number')).toHaveText(NUMBER[EXPECT]);
    await page.reload();
    app = await appFrame(page, 'Package version');
    await expect(app.getByTestId('package-marker')).toHaveText(EXPECT, { timeout: 60_000 });
    const report = await app.getByTestId('package-report').innerText();
    record(info, {
      browserVersion: browser.version(), case: caseId, story: 'SMF-5', org: 'install-test',
      persona: `MF-${persona.toUpperCase()}`, launchMs,
      observed: `installed app opened as persona; marker ${EXPECT} (${NUMBER[EXPECT]}) before and after reload`,
      marker: report.split('\n').filter(l => /^(package|bundle build)/.test(l)).join('; '),
    });
    await ctx.close();
  });
}

test('PKG-03 restricted: installed app denied without FieldSupport_Access, baseline restored', async ({ browser }, info) => {
  test.skip(EXPECT !== 'v1', 'PKG-03 runs in the v1 phase (stage 63)');
  setSubscriberAppAccess('restricted', false);
  try {
    const ctx = await subscriberContext(browser, 'restricted');
    const page = ctx.pages()[0];
    const app = await appFrame(page);
    await page.waitForTimeout(5_000);
    const rendered = await app.getByRole('heading', { name: 'Launch check' }).count();
    const bodyText = (await page.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' ');
    record(info, { browserVersion: browser.version(), case: 'PKG-03', story: 'SMF-5', org: 'install-test', persona: 'MF-RESTRICTED',
      observed: rendered ? 'APP RENDERED without access' : `not rendered; page said: ${bodyText}` });
    expect(rendered, 'installed app must not render for RESTRICTED without FieldSupport_Access').toBe(0);
    await ctx.close();
  } finally {
    setSubscriberAppAccess('restricted', true);
  }
  const ctx2 = await subscriberContext(browser, 'restricted');
  const app2 = await appFrame(ctx2.pages()[0]);
  await expect(app2.getByRole('heading', { name: 'Launch check' })).toBeVisible({ timeout: 60_000 });
  record(info, { browserVersion: browser.version(), case: 'PKG-03', story: 'SMF-5', org: 'install-test', persona: 'MF-RESTRICTED',
    observed: 'baseline restored: installed app renders again' });
  await ctx2.close();
});
