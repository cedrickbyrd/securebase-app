import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  retries: isCI ? 1 : 0,
  use: {
    baseURL: process.env.PORTAL_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: isCI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
      ]
    : [
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'chromium',
          use: { browserName: 'chromium' },
        },
      ],
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
