import { expect, type Frame, type Page } from '@playwright/test';

/**
 * SMF-13/14 helpers for the cloud specs: reach a probe page inside the deployed Field Support
 * app (Lightning frame or full page) through the app's own navigation, never via guessed URLs.
 */
export async function frameWith(page: Page, has: (f: Frame) => Promise<boolean>, timeoutMs = 60_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      if (await has(f).catch(() => false)) return f;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('app frame not found');
}

/** Opens Probes → the probe whose link text matches `linkName`, returns the frame showing `heading`. */
export async function openProbe(page: Page, linkName: RegExp, heading: string): Promise<Frame> {
  await page.waitForLoadState('domcontentloaded');
  const app = await frameWith(page, async f => (await f.getByRole('link', { name: 'Probes' }).count()) > 0);
  await app.getByRole('link', { name: 'Probes' }).first().click();
  await expect(app.getByRole('link', { name: linkName })).toBeVisible({ timeout: 30_000 });
  await app.getByRole('link', { name: linkName }).click();
  const probe = await frameWith(page, async f => (await f.getByRole('heading', { name: heading }).count()) > 0);
  return probe;
}

export async function probeEvidence(frame: Frame, testId: string): Promise<Record<string, unknown>> {
  return JSON.parse((await frame.getByTestId(testId).textContent()) ?? '{}') as Record<string, unknown>;
}

/** Taps points on the canvas until a part is selected; returns the selected text. */
export async function selectByPointer(page: Page, frame: Frame): Promise<string> {
  const box = await frame.locator('[data-testid="viewer-host"] canvas').boundingBox();
  if (!box) throw new Error('3D canvas not visible');
  for (const [dx, dy] of [[0, 0], [-0.15, 0], [0.15, 0], [-0.25, 0.05], [0.2, -0.05], [0, 0.1]]) {
    await page.mouse.click(box.x + box.width * (0.5 + dx), box.y + box.height * (0.5 + dy));
    const text = (await frame.getByTestId('selected-part').textContent()) ?? '';
    if (!text.includes('none')) return text;
  }
  return 'none';
}

/** Sanitized subset of the probe's evidence JSON for record(): no URLs beyond logical names. */
export function summarize(ev: Record<string, unknown>): Record<string, unknown> {
  const pick = (k: string): unknown => ev[k];
  return {
    webgl: pick('webgl'),
    load: (pick('load') as { timings?: unknown; scene?: unknown; rendererInfo?: unknown; blockedExternalUrls?: unknown } | null) ?? null,
    protocol: pick('protocol'),
    judgement: pick('judgement'),
    disposals: pick('disposals'),
    status: pick('status'),
    error: pick('error'),
    model: pick('model'),
  };
}
