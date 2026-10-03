import { test, expect, type Page, type Frame } from '@playwright/test';
import { personaContext, personaDisplayName, setAppAccess, type Persona } from './persona';
import { record } from './record';

// SMF-4 HOST-01/02 in cloud desktop browsers. HOST-03 mobile rows remain human-only.
async function appFrame(page: Page): Promise<Page | Frame> {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  for (const f of page.frames()) {
    if (await f.getByRole('heading', { name: 'Launch check' }).count()) return f;
  }
  return page;
}

for (const persona of ['tech', 'support'] as Persona[]) {
  test(`HOST-01 ${persona}: launch, navigate, reload, same user`, async ({ browser }, info) => {
    const expectedName = personaDisplayName(persona);
    const ctx = await personaContext(browser, persona);
    const page = ctx.pages()[0];
    const t0 = Date.now();
    let app = await appFrame(page);
    await expect(app.getByRole('heading', { name: 'Launch check' })).toBeVisible({ timeout: 60_000 });
    const launchMs = Date.now() - t0;
    await expect(app.getByTestId('user-name')).toHaveText(expectedName);
    const hostBlock = await app.getByTestId('host-context').innerText();
    await app.getByRole('link', { name: 'Navigation check' }).first().click();
    await expect(app.getByTestId('nav-user')).toHaveText(expectedName);
    await page.reload();
    app = await appFrame(page);
    await expect(app.getByTestId('nav-user')).toHaveText(expectedName, { timeout: 60_000 });
    record(info, { browserVersion: browser.version(), case: 'HOST-01', persona: `MF-${persona.toUpperCase()}`, launchMs,
      observed: 'launch check showed persona; navigation + reload kept the same user',
      host: hostBlock.split('\n').filter(l => /^(build|origin|framed|secure|user agent)/.test(l)).join('; ') });
    await ctx.close();
  });
}

test('HOST-02 restricted: app denied without FieldSupport_Access, baseline restored', async ({ browser }, info) => {
  setAppAccess('restricted', false);
  try {
    const ctx = await personaContext(browser, 'restricted');
    const page = ctx.pages()[0];
    const app = await appFrame(page);
    await page.waitForTimeout(5_000);
    const rendered = await app.getByRole('heading', { name: 'Launch check' }).count();
    const bodyText = (await page.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' ');
    expect(rendered, 'app must not render for RESTRICTED without access').toBe(0);
    record(info, { browserVersion: browser.version(), case: 'HOST-02', persona: 'MF-RESTRICTED', observed: `not rendered; page said: ${bodyText}` });
    await ctx.close();
  } finally {
    setAppAccess('restricted', true);
  }
  const ctx2 = await personaContext(browser, 'restricted');
  const app2 = await appFrame(ctx2.pages()[0]);
  await expect(app2.getByRole('heading', { name: 'Launch check' })).toBeVisible({ timeout: 60_000 });
  record(info, { browserVersion: browser.version(), case: 'HOST-02', persona: 'MF-RESTRICTED', observed: 'baseline restored: app renders again' });
  await ctx2.close();
});
