import { test, expect } from '@playwright/test';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { openProbe, probeEvidence, selectByPointer, summarize } from './smf-3d-helpers';

/**
 * SMF-13 in cloud desktop browsers (ENV-DESKTOP-EDGE, ENV-CLOUD-CHROMIUM) as real personas on
 * the deployed app. What automation CAN attest here: 3D-01 functional interaction with mouse
 * and window resize; 3D-03 missing model, context loss/restore, unmount/remount, fallback,
 * resource release. What it CANNOT attest (human rows, testing/HUMAN-ACTIONS.md):
 *  - 3D-02 performance on any real device — cloud WebGL is SwiftShader (software); the 60 s run
 *    below is recorded ONLY as a separate cloud row and never judges 3D-02 for a device;
 *  - touch gestures, physical rotation, physical Salesforce mobile (iOS/Android);
 *  - MF-SUPPORT's own review that the selected-part label is the part they meant.
 */
const PROBE = { link: /SMF-13 · Interactive 3D equipment/, heading: '3D equipment probe' };

for (const persona of ['tech', 'support'] as Persona[]) {
  test(`3D-01 ${persona}: load, orbit, zoom, select, reset, resize`, async ({ browser }, info) => {
    const ctx = await personaContext(browser, persona);
    const page = ctx.pages()[0];
    const probe = await openProbe(page, PROBE.link, PROBE.heading);
    await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 60_000 });
    const canvas = probe.locator('[data-testid="viewer-host"] canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 40, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -400);
    const pointerSelection = await selectByPointer(page, probe);
    expect(pointerSelection).not.toContain('none');
    await expect(probe.getByTestId('selected-label')).toBeVisible();
    await probe.getByRole('button', { name: 'Suction inlet' }).click();
    await expect(probe.getByTestId('selected-part')).toContainText('MF-PART-INLET');
    await probe.getByRole('button', { name: 'Reset view' }).click();
    await expect(probe.getByTestId('selected-part')).toContainText('none');
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(800);
    const ev = await probeEvidence(probe, 'smf13-evidence');
    const resizes = (ev.log as { msg: string }[]).filter(l => l.msg.startsWith('resize')).length;
    expect(resizes).toBeGreaterThan(1);
    record(info, { browserVersion: browser.version(), case: '3D-01', persona: `MF-${persona.toUpperCase()}`, pointerSelection, resizes,
      observed: 'model loaded; drag orbit, wheel zoom, pointer + list selection with label, reset, resize handled', ...summarize(ev) });
    await ctx.close();
  });
}

test('3D-02 cloud row only (software WebGL — not device evidence): 60 s protocol', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const ctx = await personaContext(browser, 'tech');
  const page = ctx.pages()[0];
  const probe = await openProbe(page, PROBE.link, PROBE.heading);
  await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 60_000 });
  await probe.getByRole('button', { name: 'Run 60 s protocol' }).click();
  await expect(probe.getByTestId('judgement')).toBeVisible({ timeout: 150_000 });
  const ev = await probeEvidence(probe, 'smf13-evidence');
  record(info, { browserVersion: browser.version(), case: '3D-02', persona: 'MF-TECH', row: 'ENV-CLOUD (software-rendered)',
    caveat: 'SwiftShader software WebGL: never used to judge 3D-02 on a device', ...summarize(ev) });
  await ctx.close();
});

test('3D-03 tech: missing model, context loss/restore, unmount/remount, no-WebGL fallback', async ({ browser }, info) => {
  const ctx = await personaContext(browser, 'tech');
  const page = ctx.pages()[0];
  const probe = await openProbe(page, PROBE.link, PROBE.heading);
  await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 60_000 });
  await probe.getByRole('button', { name: 'Load missing model' }).click();
  await expect(probe.getByTestId('status')).toHaveText('error', { timeout: 30_000 });
  await expect(probe.getByTestId('static-fallback')).toBeVisible();
  await expect(probe.getByRole('img', { name: /Static rendering of synthetic pump/ })).toBeVisible();
  const missingError = (await probeEvidence(probe, 'smf13-evidence')).error;
  await probe.getByRole('button', { name: 'Retry loading MF-MODEL-SMALL' }).click();
  await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 60_000 });
  await probe.getByRole('button', { name: 'Lose graphics context' }).click();
  await expect(probe.getByTestId('status')).toHaveText('context-lost');
  await expect(probe.getByTestId('static-fallback')).toBeVisible();
  await probe.getByRole('button', { name: 'Restore graphics context' }).click();
  await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 30_000 });
  await probe.getByRole('button', { name: 'Unmount 3D view' }).click();
  await expect(probe.getByTestId('status')).toHaveText('unmounted');
  await expect(probe.locator('canvas')).toHaveCount(0);
  await probe.getByRole('button', { name: 'Remount 3D view' }).first().click();
  await expect(probe.getByTestId('status')).toHaveText('ready', { timeout: 60_000 });
  await probe.getByRole('button', { name: 'Simulate no WebGL' }).click();
  await expect(probe.getByTestId('static-fallback')).toBeVisible();
  const ev = await probeEvidence(probe, 'smf13-evidence');
  const disposals = ev.disposals as { afterResourceDispose: { geometries: number } }[];
  for (const d of disposals) expect(d.afterResourceDispose.geometries).toBe(0);
  record(info, { browserVersion: browser.version(), case: '3D-03', persona: 'MF-TECH', missingError,
    observed: 'missing model -> fallback image with alt text; context lost -> fallback, restored -> ready; unmount released resources; remount ready; simulated no-WebGL -> fallback',
    ...summarize(ev) });
  await ctx.close();
});
