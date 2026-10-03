import { test, expect, type Frame, type Page } from '@playwright/test';
import { personaContext } from './persona';
import { record } from './record';
import { joinCaseRoom, openProbe } from './smf-media';

// SMF-8 SHARE-01..03 in cloud desktop rows (ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM separately),
// MF-SUPPORT sharing to MF-TECH in MF-ROOM-001 through RealtimeKit. With
// --use-fake-ui-for-media-stream the browser auto-accepts getDisplayMedia and shares a FAKE
// desktop (not the diagnostic screen), so this attests: start/stop/restart from a click,
// receive-side frames, call kept usable after cancel (stubbed rejection), static-image
// fallback received (decoded marker), and whether screen audio is captured. It does NOT attest:
// a person seeing the diagnostic screen, the real OS picker, or ANY mobile row (mobile
// receiving and mobile originating are human — docs/test-scripts/SMF-8-SHARE.md).

const HEADING = 'Screen share during the call';
const LINK = /Screen share in the call/;
const txt = async (f: Page | Frame, id: string): Promise<string> => (await f.getByTestId(id).first().textContent()) ?? '';
const frames = (t: string): number => Number(/frames (\d+)/.exec(t)?.[1] ?? 0);

test('SHARE-01/03 SUPPORT → TECH: start, receive, stop, restart; screen audio reported', async ({ browser }, info) => {
  const sup = await personaContext(browser, 'support');
  const tech = await personaContext(browser, 'tech');
  const s = await openProbe(sup.pages()[0], 'SMF-8', HEADING, LINK);
  const t = await openProbe(tech.pages()[0], 'SMF-8', HEADING, LINK);
  await joinCaseRoom(s, 'SUPPORT');
  await joinCaseRoom(t, 'TECH');
  const obs: Record<string, string> = {};

  await s.getByTestId('share-start').click();
  await expect(t.getByTestId('remote-screen')).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(async () => frames(await txt(t, 'remote-screen-stats')), { timeout: 30_000 }).toBeGreaterThan(10);
  obs.firstShareAtTech = await txt(t, 'remote-screen-stats');
  obs.supportAttempts = (await txt(s, 'share-attempts')).slice(-400);

  await s.getByTestId('share-stop').click();
  await expect(t.getByTestId('remote-screen')).toHaveCount(0, { timeout: 30_000 });
  obs.afterStopAtTech = 'no received screen';

  await s.getByTestId('share-start').click();
  await expect(t.getByTestId('remote-screen')).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(async () => frames(await txt(t, 'remote-screen-stats')), { timeout: 30_000 }).toBeGreaterThan(10);
  obs.restartAtTech = await txt(t, 'remote-screen-stats');
  obs.screenAudio = /screen audio (captured|not captured)/.exec(await txt(s, 'share-attempts'))?.[0] ?? 'unknown';
  await s.getByTestId('share-stop').click();

  record(info, { case: 'SHARE-01', personas: 'MF-SUPPORT → MF-TECH', browserVersion: browser.version(), devices: 'fake desktop capture', obs });
  record(info, { case: 'SHARE-03', personas: 'MF-SUPPORT', browserVersion: browser.version(), screenAudio: obs.screenAudio, note: 'captured/not captured as reported by the SDK track; not counted from a button' });
  await sup.close();
  await tech.close();
});

test('SHARE-02 cancel/denial keeps the call usable; static-image fallback is received', async ({ browser }, info) => {
  const sup = await personaContext(browser, 'support');
  await sup.addInitScript(() => {
    // Stubbed cancelled/denied picker: cloud browsers auto-accept, so rejection is simulated here.
    navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException('Permission denied by user', 'NotAllowedError'));
  });
  const tech = await personaContext(browser, 'tech');
  const supPage = sup.pages()[0];
  await supPage.reload();
  const s = await openProbe(supPage, 'SMF-8', HEADING, LINK);
  const t = await openProbe(tech.pages()[0], 'SMF-8', HEADING, LINK);
  await joinCaseRoom(s, 'SUPPORT');
  await joinCaseRoom(t, 'TECH');
  await s.getByTestId('share-start').click();
  await expect(s.getByTestId('share-failure-code')).toBeVisible({ timeout: 30_000 });
  const code = await txt(s, 'share-failure-code');
  const phase = await txt(s, 'phase');
  await expect(s.getByTestId('fallback-image')).toBeVisible();
  await s.getByTestId('fallback-toggle').click();
  await expect.poll(async () => Number(/changes\/10 s (\d+)/.exec(await txt(t, 'receive-video'))?.[1] ?? 0), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  const received = await txt(t, 'receive-video');
  record(info, { case: 'SHARE-02', personas: 'MF-SUPPORT → MF-TECH', browserVersion: browser.version(), cancelCode: code, callPhaseAfterCancel: phase, fallbackReceivedByTech: received,
    note: 'cancel stubbed (fake UI auto-accepts); mobile originating/receiving are human rows' });
  expect(code).toBe('CANCELLED_OR_DENIED');
  expect(phase).toBe('joined');
  await sup.close();
  await tech.close();
});
