import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 *
 * Local (Mac 10.15): firefox only — chromium-headless-shell and webkit
 * are not supported on Catalina. Set CI=true to run all browsers.
 */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
  },

  projects: isCI
    ? [
        { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox',       use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit',        use: { ...devices['Desktop Safari'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
      ]
    : [
        // Mac 10.15 only supports firefox in the current Playwright release
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      ],
});
