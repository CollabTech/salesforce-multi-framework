import { defineConfig } from '@playwright/test';

// Rows: ENV-DESKTOP-EDGE = official Microsoft Edge (Linux) installed by scripts/cloud/session-setup.sh.
// ENV-CLOUD-CHROMIUM = Playwright Chromium: NOT Google Chrome; it never fills ENV-DESKTOP-CHROME.
// Branded Chrome runs only if dl.google.com is allowed and google-chrome is installed (channel 'chrome').
const headed = process.env.SMF_HEADED === '1'; // run under xvfb-run for headed fidelity
const base = { headless: !headed, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] };

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1, // personas share one org; keep runs serial and deterministic
  reporter: [['line'], ['json', { outputFile: '../../private/cloud-e2e-last-run.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off' },
  outputDir: '../../private/cloud-e2e-artifacts', // traces/screenshots may show org domains: private until reviewed
  projects: [
    { name: 'ENV-DESKTOP-EDGE', use: { channel: 'msedge', launchOptions: base } },
    { name: 'ENV-CLOUD-CHROMIUM', use: { launchOptions: { ...base, executablePath: process.env.PW_CHROMIUM_PATH } } },
    ...(process.env.SMF_CHROME === '1' ? [{ name: 'ENV-DESKTOP-CHROME', use: { channel: 'chrome' as const, launchOptions: base } }] : []),
  ],
});
