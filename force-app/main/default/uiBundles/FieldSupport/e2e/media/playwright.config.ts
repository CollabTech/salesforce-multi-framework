import { defineConfig, devices } from '@playwright/test';

/**
 * ENV-EMULATION-LOCALHOST only (SMF-6..9 media probes). Chromium fake media devices and
 * permission switches exercise probe logic; results are never host or device evidence.
 * Run: npm run build:e2e && npx playwright test -c e2e/media/playwright.config.ts
 * Files are named *.media.ts so the template's e2e config (testDir ./e2e, *.spec.ts) skips them.
 */
const PORT = 5176;
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const chrome = devices['Desktop Chrome'];

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '../../test-results/e2e-media.json' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [
    {
      // Fake camera/mic and auto-accepted prompts: grant paths.
      name: 'fake-devices-granted',
      testMatch: /.*\.granted\.media\.ts/,
      use: {
        ...chrome,
        launchOptions: { ...exe, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
      },
    },
    {
      // Fake devices, but no auto-accept: permission is denied until the test grants it.
      name: 'fake-devices-prompt',
      testMatch: /.*\.prompt\.media\.ts/,
      use: { ...chrome, launchOptions: { ...exe, args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'] } },
    },
    {
      // No fake devices: the container has no camera or microphone hardware.
      name: 'no-devices',
      testMatch: /.*\.nodevice\.media\.ts/,
      use: { ...chrome, launchOptions: { ...exe, args: ['--use-fake-ui-for-media-stream'] } },
    },
  ],
  webServer: {
    command: `npx serve -s dist -l ${PORT}`,
    cwd: '../..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
