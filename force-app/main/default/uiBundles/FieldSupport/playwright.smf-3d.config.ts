import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// SMF-13/14 localhost runs (ENV-EMULATION-LOCALHOST): same setup as playwright.config.ts on a
// dedicated port so parallel story branches do not share a static server. Build first with
// `npm run build:e2e`. Usage: npx playwright test -c playwright.smf-3d.config.ts
const PORT = Number(process.env.SMF_3D_PORT ?? 5313);

export default defineConfig({
  ...base,
  testMatch: /smf-1[34]-.*\.spec\.ts/,
  reporter: [['line']],
  workers: 1,
  fullyParallel: false,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: { command: `npx serve -s dist -l ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 60_000 },
});
