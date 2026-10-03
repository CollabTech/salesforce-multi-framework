import type { Page } from '@playwright/test';

/**
 * Independent observer: wraps getUserMedia/getDisplayMedia before the app loads and keeps
 * every track handed to the page, so a test can check readyState after the probe unmounts
 * without trusting the probe's own report.
 */
export async function observeTracks(page: Page): Promise<void> {
  await page.addInitScript(() => {
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

export async function observedTrackStates(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { __smfTracks: MediaStreamTrack[] }).__smfTracks.map(t => `${t.kind}:${t.readyState}`),
  );
}
