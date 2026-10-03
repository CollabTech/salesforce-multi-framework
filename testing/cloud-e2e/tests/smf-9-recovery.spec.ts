import { test, expect, type Frame, type Page } from '@playwright/test';
import { personaContext } from './persona';
import { record } from './record';
import { joinCaseRoom, observeTracks, observedTrackStates, openProbe } from './smf-media';

// SMF-9 REC-01 (network loss ×3) and REC-03 (leave/rejoin ×3) on cloud DESKTOP rows
// (ENV-DESKTOP-EDGE; ENV-CLOUD-CHROMIUM separately) during a real RealtimeKit call between
// MF-TECH and MF-SUPPORT with fake devices. context.setOffline cuts TECH's browser network.
// Attests: disconnect detection, reconnect timing, duplicate participants, local-track cleanup
// on leave, rejoin without duplicates — on desktop only. Does NOT attest: Wi-Fi↔cellular
// switch, background/foreground, lock/unlock, incoming call, or anything on a phone (the story's
// focus) — those are human (docs/test-scripts/SMF-9-RECOVERY.md).

const HEADING = 'Call recovery';
const LINK = /Call recovery/;
const txt = async (f: Page | Frame, id: string): Promise<string> => (await f.getByTestId(id).first().textContent()) ?? '';

test('REC-01 desktop: TECH network loss/recovery ×3; REC-03 leave/rejoin ×3', async ({ browser }, info) => {
  test.setTimeout(15 * 60_000);
  const techCtx = await personaContext(browser, 'tech');
  await observeTracks(techCtx);
  const supCtx = await personaContext(browser, 'support');
  const techPage = techCtx.pages()[0];
  await techPage.reload();
  const tech = await openProbe(techPage, 'SMF-9', HEADING, LINK);
  const sup = await openProbe(supCtx.pages()[0], 'SMF-9', HEADING, LINK);
  await joinCaseRoom(tech, 'TECH');
  await joinCaseRoom(sup, 'SUPPORT');
  await expect(tech.getByTestId('recovery-state')).toContainText('remotes=1', { timeout: 60_000 });

  const offlineMs = Number(process.env.SMF9_OFFLINE_MS ?? 15_000);
  for (const run of [1, 2, 3]) {
    await tech.getByTestId(`run-${run}`).click();
    await techCtx.setOffline(true);
    await techPage.waitForTimeout(offlineMs);
    await techCtx.setOffline(false);
    const recovered = await expect(tech.getByTestId('recovery-state'))
      .toContainText('socket=connected', { timeout: 120_000 })
      .then(() => true, () => false);
    if (!recovered) await tech.getByTestId('close-unrecovered').click();
    await techPage.waitForTimeout(10_000);
  }
  const episodes = await txt(tech, 'episodes');
  const variabilityText = await txt(tech, 'variability');
  const supRemotesAfter = await txt(sup, 'recovery-state');

  const rejoin: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    await tech.getByTestId('leave-call').click();
    await expect(tech.getByTestId('phase')).toHaveText('left');
    const lastLeave = await txt(tech, 'last-leave');
    const observer = await observedTrackStates(tech);
    await expect(sup.getByTestId('recovery-state')).toContainText('remotes=0', { timeout: 30_000 });
    await tech.getByTestId('join').click();
    await expect(tech.getByTestId('phase')).toHaveText('joined', { timeout: 60_000 });
    await expect(sup.getByTestId('recovery-state')).toContainText('remotes=1', { timeout: 60_000 });
    const dup = await sup.getByTestId('duplicate-alert').count();
    rejoin.push(`#${i}: ${lastLeave}; observer live after leave=${observer.filter(s => s.endsWith(':live')).length}; SUPPORT duplicate alert=${dup > 0}`);
  }

  record(info, { case: 'REC-01', personas: 'MF-TECH (offline) + MF-SUPPORT', browserVersion: browser.version(), scenario: 'network loss (desktop, setOffline)', offlineMs, episodes, variability: variabilityText, supportViewAfter: supRemotesAfter });
  record(info, { case: 'REC-03', personas: 'MF-TECH + MF-SUPPORT', browserVersion: browser.version(), rejoin });
  expect.soft(episodes, 'every run recovered automatically').not.toContain('NOT RECOVERED');
  expect.soft(episodes, 'no duplicate participants').not.toMatch(/\| YES \|/);
  expect(rejoin.every(r => r.includes('all ended=true') && r.includes('duplicate alert=false'))).toBe(true);
  await techCtx.close();
  await supCtx.close();
});
