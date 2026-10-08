import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { personaContext } from './persona';
import { openProbe } from './files-markup-helpers';

// SMF-12 deploy prerequisite (stage 49): observe, as MF-TECH in the real Salesforce host, the
// origin of the document that runs the live-markup probe. A browser WebSocket sends exactly this
// value as its Origin header, so it is what the sync Worker's allowlist must contain. The origin
// is observed here, not assumed from the My Domain name. Written to private/ (org-specific).
test('SMF-12 observe the app origin for the sync allowlist', async ({ browser }, info) => {
  const ctx = await personaContext(browser, 'tech');
  try {
    const { page, app } = await openProbe(ctx, /SMF-12 · Live two-user markup/, /Live two-user markup/);
    const appOrigin = await app.evaluate(() => location.origin);
    const topOrigin = new URL(page.url()).origin;
    expect(appOrigin).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    const out = join(__dirname, '..', '..', '..', 'private');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'smf12-app-origin.json'),
      JSON.stringify({ appOrigin, topOrigin, framed: appOrigin !== topOrigin, project: info.project.name, observedAt: new Date().toISOString() }, null, 2));
  } finally {
    await ctx.close();
  }
});
