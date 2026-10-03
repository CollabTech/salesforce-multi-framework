import { test, expect, type Frame, type Page } from '@playwright/test';
import { personaContext } from './persona';
import { record } from './record';
import { observeTracks, observedTrackStates, openProbe, sanitizeDiagnostics } from './smf-media';

// SMF-6 CAP-01..03 in cloud desktop rows (ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM as its own row),
// as MF-TECH inside the deployed Salesforce app, with Chromium/Edge FAKE camera and mic.
// Attests: gesture-gated capture code paths, track lifecycle, real error reporting, denial →
// retry, device switching, leave/unmount stops tracks — in the real Salesforce host (framing,
// Permissions-Policy, CSP). Does NOT attest: a real camera or microphone working, the preview
// showing the scene, the meter following a voice, OS prompts/indicators, or any mobile row.
// Those stay human: docs/test-scripts/SMF-6-CAPTURE.md (HUMAN-ACTIONS rows for SMF-6).

const HEADING = 'Camera and microphone capture';
const num = async (f: Page | Frame, id: string): Promise<number> => Number((await f.getByTestId(id).textContent())?.match(/[\d.]+/)?.[0] ?? 0);

test.describe('SMF-6 capture (MF-TECH, fake devices)', () => {
  test('CAP-01 camera-only, mic-only, combined from a click; tracks live with activity', async ({ browser }, info) => {
    const ctx = await personaContext(browser, 'tech');
    await observeTracks(ctx);
    const page = ctx.pages()[0];
    await page.reload();
    const app = await openProbe(page, 'SMF-6', HEADING);
    const results: Record<string, string> = {};
    for (const [btn, kinds] of [['start-camera', ['video']], ['start-mic', ['audio']], ['start-both', ['video', 'audio']]] as const) {
      await app.getByTestId(btn).click();
      const failure = await app.getByTestId('failure-code').textContent({ timeout: 3_000 }).catch(() => null);
      if (failure) {
        results[btn] = `FAILED ${failure}`; // host limitation finding (e.g. framed without allow="camera")
        continue;
      }
      for (const k of kinds) await expect(app.getByTestId(`ready-${k}`)).toHaveText('live');
      if (kinds.includes('video' as never)) await expect.poll(() => num(app, 'frames'), { timeout: 15_000 }).toBeGreaterThan(5);
      if (kinds.includes('audio' as never)) await expect.poll(() => num(app, 'mic-peak'), { timeout: 15_000 }).toBeGreaterThan(0);
      results[btn] = `live ${kinds.join('+')}; frames=${await num(app, 'frames')}; peak=${await num(app, 'mic-peak')}`;
    }
    record(info, { case: 'CAP-01', persona: 'MF-TECH', browserVersion: browser.version(), devices: 'fake', results,
      diagnostics: sanitizeDiagnostics(await app.getByTestId('diagnostics').innerText()) });
    expect(Object.values(results).every(r => r.startsWith('live')), JSON.stringify(results)).toBe(true);
    await ctx.close();
  });

  test('CAP-02 denied → real error, retry after grant; unavailable device; mic switch', async ({ browser, playwright }, info) => {
    // Separate browser WITHOUT auto-accept: prompts are denied until the test grants permission.
    const denying = await playwright.chromium.launch({
      channel: info.project.use.channel,
      executablePath: info.project.use.channel ? undefined : process.env.PW_CHROMIUM_PATH,
      headless: process.env.SMF_HEADED !== '1',
      args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'],
    });
    try {
      const ctx = await personaContext(denying, 'tech');
      const page = ctx.pages()[0];
      const app = await openProbe(page, 'SMF-6', HEADING);
      await app.getByTestId('start-both').click();
      const denied = await app.getByTestId('failure-code').textContent();
      await ctx.grantPermissions(['camera', 'microphone']);
      await app.getByTestId('start-both').click();
      await expect(app.getByTestId('ready-video')).toHaveText('live');
      record(info, { case: 'CAP-02', persona: 'MF-TECH', browserVersion: browser.version(), path: 'deny→grant→retry', denied, retry: 'live video+audio' });
      expect(denied).toBe('NotAllowedError');
      await ctx.close();
    } finally {
      await denying.close();
    }

    const ctx = await personaContext(browser, 'tech');
    await observeTracks(ctx);
    const page = ctx.pages()[0];
    await page.reload();
    const app = await openProbe(page, 'SMF-6', HEADING);
    await app.getByTestId('start-both').click();
    await expect(app.getByTestId('ready-audio')).toHaveText('live');
    await app.getByTestId('sim-camera').click();
    const simCamera = await app.getByTestId('failure-code').textContent();
    await app.getByTestId('sim-mic').click();
    const simMic = await app.getByTestId('failure-code').textContent();
    await expect(app.getByTestId('ready-video')).toHaveText('live');
    const before = (await app.getByTestId('track-audio').locator('td').nth(1).textContent()) ?? '';
    await app.getByTestId('mic-select').click();
    const options = app.getByRole('option');
    let switched = 'not offered (one microphone exposed)';
    for (let i = 0; i < (await options.count()); i += 1) {
      if ((await options.nth(i).textContent()) !== before) {
        await options.nth(i).click();
        await expect(app.getByTestId('track-audio').locator('td').nth(1)).not.toHaveText(before);
        switched = `switched; observer: ${(await observedTrackStates(app)).join(',')}`;
        break;
      }
    }
    record(info, { case: 'CAP-02', persona: 'MF-TECH', browserVersion: browser.version(), simCamera, simMic, switched });
    expect([simCamera, simMic]).toEqual(['OverconstrainedError', 'OverconstrainedError']);
    await ctx.close();
  });

  test('CAP-03 leave (unmount) and Stop all end every track', async ({ browser }, info) => {
    const ctx = await personaContext(browser, 'tech');
    await observeTracks(ctx);
    const page = ctx.pages()[0];
    await page.reload();
    const app = await openProbe(page, 'SMF-6', HEADING);
    await app.getByTestId('start-both').click();
    await expect(app.getByTestId('ready-video')).toHaveText('live');
    await app.getByTestId('leave').click();
    await expect(app.getByRole('heading', { name: 'Capability probes' })).toBeVisible();
    const afterLeave = await observedTrackStates(app);
    await app.getByRole('link', { name: /^SMF-6 ·/ }).click();
    await expect(app.getByRole('heading', { name: HEADING })).toBeVisible(); // same SPA frame
    const leaveBox = await app.getByTestId('previous-leave').innerText();
    await app.getByTestId('start-both').click();
    await expect(app.getByTestId('ready-audio')).toHaveText('live');
    await app.getByTestId('stop-all').click();
    const afterStop = await observedTrackStates(app);
    record(info, { case: 'CAP-03', persona: 'MF-TECH', browserVersion: browser.version(), afterLeave, leaveBox, afterStop });
    expect(afterLeave.length).toBeGreaterThanOrEqual(2);
    expect([...afterLeave, ...afterStop].every(s => s.endsWith(':ended'))).toBe(true);
    await ctx.close();
  });
});
