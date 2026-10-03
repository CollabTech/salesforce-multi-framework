import { expect, type BrowserContext, type Frame, type Page } from '@playwright/test';

/**
 * Shared helpers for the SMF-6..9 media specs (cloud desktop rows only).
 * Fake devices (--use-fake-device-for-media-stream, set in playwright.config.ts) prove code
 * paths and track lifecycle in the real Salesforce host. They NEVER prove real camera/mic
 * capability, audio heard or video seen — those rows stay human (testing/HUMAN-ACTIONS.md).
 */

/** Frame (or page) that currently renders a heading with this name. */
export async function frameWithHeading(page: Page, name: string | RegExp, timeoutMs = 60_000): Promise<Page | Frame> {
  const until = Date.now() + timeoutMs;
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  while (Date.now() < until) {
    for (const f of page.frames()) {
      if (await f.getByRole('heading', { name }).count().catch(() => 0)) return f;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`heading ${String(name)} not rendered in any frame within ${timeoutMs} ms`);
}

/** From the launch check, open a probe through in-app navigation (no deep link assumed). */
export async function openProbe(page: Page, story: string, heading: string | RegExp, link?: RegExp): Promise<Page | Frame> {
  const home = await frameWithHeading(page, 'Launch check');
  await home.getByRole('link', { name: 'Capability probes' }).first().click();
  const list = await frameWithHeading(page, 'Capability probes');
  await list.getByRole('link', { name: link ?? new RegExp(`^${story} ·`) }).first().click();
  return frameWithHeading(page, heading);
}

/** Keep every track handed out by getUserMedia/getDisplayMedia in every frame (independent of the probe). */
export async function observeTracks(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(() => {
    const w = window as unknown as { __smfTracks: MediaStreamTrack[] };
    w.__smfTracks = [];
    const md = navigator.mediaDevices;
    if (!md) return;
    for (const name of ['getUserMedia', 'getDisplayMedia'] as const) {
      const orig = md[name]?.bind(md) as ((c?: MediaStreamConstraints) => Promise<MediaStream>) | undefined;
      if (!orig) continue;
      (md as unknown as Record<string, unknown>)[name] = async (c?: MediaStreamConstraints) => {
        const s = await orig(c);
        w.__smfTracks.push(...s.getTracks());
        return s;
      };
    }
  });
}

export async function observedTrackStates(f: Page | Frame): Promise<string[]> {
  return f.evaluate(() =>
    ((window as unknown as { __smfTracks?: MediaStreamTrack[] }).__smfTracks ?? []).map(t => `${t.kind}:${t.readyState}`),
  );
}

/** SMF-7 probe (and its SMF-8/9 extensions): find MF-CASE-001 as the persona and join MF-ROOM-001 with mic + camera on. */
export async function joinCaseRoom(app: Page | Frame, role: 'TECH' | 'SUPPORT', media = true): Promise<void> {
  await app.getByRole('button', { name: role, exact: true }).click();
  await app.getByTestId('find-case').click();
  await expect(app.getByTestId('case-lookup')).toHaveText('MF-CASE-001 visible to you (id hidden)', { timeout: 30_000 });
  await app.getByTestId('join').click();
  await expect(app.getByTestId('phase')).toHaveText('joined', { timeout: 60_000 });
  if (media) {
    await app.getByTestId('toggle-mic').click();
    await app.getByTestId('toggle-camera').click();
  }
}

/** Keep only the diagnostics lines safe to publish (no user agent build IDs beyond versions, no URLs). */
export function sanitizeDiagnostics(text: string): string {
  return text
    .split('\n')
    .filter(l => /^(build|secure context|APIs|policy API|permission state|live tracks|  (audio|video)|camera frames|mic peak|last failure|last leave)/.test(l))
    .join('; ')
    .replace(/https?:\/\/\S+/g, '<url>');
}
