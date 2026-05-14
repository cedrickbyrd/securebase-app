import { test, expect } from '@playwright/test';

const SIMULATION_TOKEN = process.env.TEST_SIMULATION_TOKEN || 'SIMULATION_TOKEN_FOR_UI_SMOKE_TEST_ONLY';

const resolveBaseUrl = () => process.env.PORTAL_URL || process.env.DEMO_URL || 'https://securebase.tximhotep.com';
const buildUrl = (baseURL, path) => `${baseURL}${path}`;
const containsJavaScriptErrorPattern = (text) => /\bError:\b|ReferenceError|TypeError|SyntaxError|at\s+\w+/i.test(text);

const injectSession = async (page) => {
  await page.evaluate(() => {
    sessionStorage.setItem('sessionToken', 'mock-auth-token-e2e-test');
  });
};

test.describe('Customer #1 (Matthew) — Full Journey Simulation', () => {
  let baseURL;

  test.beforeEach(async () => {
    baseURL = resolveBaseUrl();
  });

  test.describe('Scenario 1: Invite Link — Activate Account', () => {
    test('accept-invite page loads without JS errors and shows activation form', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(buildUrl(baseURL, `/accept-invite?token=${SIMULATION_TOKEN}`), { waitUntil: 'domcontentloaded' });

      await expect(page.getByText('Activate your account')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('accept-invite submit handles success redirect or friendly API error', async ({ page }) => {
      await page.goto(buildUrl(baseURL, `/accept-invite?token=${SIMULATION_TOKEN}`));

      await page.getByLabel('New Password').fill('StrongPassw0rd!');
      await page.getByLabel('Confirm Password').fill('StrongPassw0rd!');
      await page.getByRole('button', { name: 'Activate Account & Sign In' }).click();

      await Promise.race([
        page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => null),
        page.locator('.error-message').waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      ]);

      const onDashboard = page.url().includes('/dashboard');
      if (onDashboard) {
        await expect(page).toHaveURL(/\/dashboard/);
      } else {
        const errorMessage = page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        const text = ((await errorMessage.textContent()) || '').trim();
        expect(text.length).toBeGreaterThan(0);
      }
    });

    test('accept-invite form validates password mismatch and minimum length', async ({ page }) => {
      await page.goto(buildUrl(baseURL, `/accept-invite?token=${SIMULATION_TOKEN}`));

      await page.getByLabel('New Password').fill('short');
      await page.getByLabel('Confirm Password').fill('different');
      await page.getByRole('button', { name: 'Activate Account & Sign In' }).click();

      await expect(page.locator('.error-message')).toContainText(/Passwords do not match|at least 8 characters/i);
    });
  });

  test.describe('Scenario 2: Login Flow', () => {
    test('login handles both success and failure paths without blank screen', async ({ page }) => {
      await page.goto(buildUrl(baseURL, '/login'));

      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

      await page.getByLabel('Email').fill('matthew@example.com');
      await page.getByLabel('Password').fill('InvalidPass123!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await Promise.race([
        page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => null),
        page.locator('.error-message').waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      ]);

      const onDashboard = page.url().includes('/dashboard');
      if (onDashboard) {
        await expect(page).toHaveURL(/\/dashboard/);
      } else {
        const error = page.locator('.error-message');
        await expect(error).toBeVisible();
        const text = (await error.textContent()) || '';
        expect(containsJavaScriptErrorPattern(text)).toBe(false);
      }
    });
  });

  test.describe('Scenario 3: Forgot Password Flow', () => {
    test('forgot-password form renders and submit returns confirmation or friendly fallback', async ({ page }) => {
      await page.goto(buildUrl(baseURL, '/forgot-password'));

      await expect(page.getByRole('heading', { name: /Forgot your password\?/i })).toBeVisible();
      await page.getByLabel('Work Email').fill('matthew@example.com');
      await page.getByRole('button', { name: 'Send Reset Link' }).click();

      await Promise.race([
        page.getByRole('heading', { name: 'Check your email' }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        page.locator('.error-message').waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      ]);

      const confirmation = page.getByRole('heading', { name: 'Check your email' });
      const error = page.locator('.error-message');
      await expect(confirmation.or(error)).toBeVisible();
      if (await error.isVisible()) {
        await expect(error).toContainText('Something went wrong. Please try again.');
      }
    });
  });

  test.describe('Scenario 4: Dashboard Access', () => {
    test('dashboard renders when session token is present', async ({ page }) => {
      await page.goto(buildUrl(baseURL, '/login'));
      await injectSession(page);
      await page.goto(buildUrl(baseURL, '/dashboard'));

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

      const bodyText = (await page.locator('body').innerText()).toLowerCase();
      expect(bodyText).not.toContain('undefined');
      expect(bodyText).not.toContain('null');
    });

    test('dashboard redirects to login when session is missing', async ({ page }) => {
      await page.goto(buildUrl(baseURL, '/dashboard'));
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Scenario 5: Accept-Invite API Route Validation & Scenario 6: Login API Route Validation', () => {
    test('/api/auth/accept-invite proxy is wired', async ({ request }) => {
      const response = await request.post(buildUrl(baseURL, '/api/auth/accept-invite'), {
        data: { password: 'StrongPassw0rd!' },
      });
      const status = response.status();
      expect(status).not.toBe(404);
      expect(status).not.toBe(502);
      expect(status).not.toBe(503);
    });

    test('/api/auth/login proxy is wired', async ({ request }) => {
      const response = await request.post(buildUrl(baseURL, '/api/auth/login'), {
        data: { api_key: 'test' },
      });
      const status = response.status();
      expect(status).not.toBe(404);
      expect(status).not.toBe(502);
      expect(status).not.toBe(503);
    });

    test('/api/auth/forgot-password proxy is wired', async ({ request }) => {
      const response = await request.post(buildUrl(baseURL, '/api/auth/forgot-password'), {
        data: { email: 'matthew@example.com' },
      });
      const status = response.status();
      expect(status).not.toBe(404);
      expect(status).not.toBe(502);
      expect(status).not.toBe(503);
    });
  });
});
