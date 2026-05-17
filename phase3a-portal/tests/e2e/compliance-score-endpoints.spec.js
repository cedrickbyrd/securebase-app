import { test, expect } from '@playwright/test';

const PORTAL = process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const FRAMEWORKS = ['SOC2', 'HIPAA', 'FedRAMP'];

async function proxyPost(request, path, data = {}) {
  return request.post(`${PORTAL}/api${path}`, { data });
}

async function proxyGet(request, path, token) {
  return request.get(`${PORTAL}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function loginAndGetToken(request, email, password) {
  const res = await proxyPost(request, '/auth/login', { email, password });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const token = body?.token || body?.session_token || body?.access_token;
  expect(token).toBeTruthy();
  return token;
}

async function seedTenantSession(page, token) {
  await page.addInitScript((jwt) => {
    sessionStorage.setItem('sessionToken', jwt);
    localStorage.setItem('userRole', 'user');
  }, token);
}

function validateFrameworkPayload(frameworkPayload) {
  expect(typeof frameworkPayload.current_score).toBe('number');
  expect(frameworkPayload.current_score).toBeGreaterThanOrEqual(0);
  expect(frameworkPayload.current_score).toBeLessThanOrEqual(100);
  expect(['Passing', 'At Risk', 'Failing']).toContain(frameworkPayload.status);
  expect(['Improving', 'Stable', 'Declining']).toContain(frameworkPayload.trend);
  expect(Array.isArray(frameworkPayload.history)).toBe(true);
  expect(frameworkPayload.history.length).toBeGreaterThan(0);
  expect(Array.isArray(frameworkPayload.violations)).toBe(true);
}

test.describe('Group 1: GET /api/tenant/compliance/history — API contract', () => {
  test('returns 200 with valid JWT', async ({ request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to validate authenticated compliance history.');

    const token = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    const res = await proxyGet(request, '/tenant/compliance/history', token);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('tenant_id');
    expect(body).toHaveProperty('generated_at');
    expect(body).toHaveProperty('frameworks');
    expect(typeof body.frameworks).toBe('object');

    const frameworkKeys = Object.keys(body.frameworks || {});
    expect(frameworkKeys.some((fw) => FRAMEWORKS.includes(fw))).toBe(true);
    for (const framework of frameworkKeys) {
      validateFrameworkPayload(body.frameworks[framework]);
    }
  });

  test('returns 401 without auth header', async ({ request }) => {
    const res = await proxyGet(request, '/tenant/compliance/history');
    expect(res.status()).toBe(401);
  });

  test('accepts ?framework=SOC2 query param', async ({ request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to validate framework filtering.');

    const token = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    const res = await proxyGet(request, '/tenant/compliance/history?framework=SOC2', token);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Object.keys(body.frameworks || {})).toEqual(['SOC2']);
  });

  test('accepts ?days=30 query param', async ({ request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to validate days filtering.');

    const token = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    const res = await proxyGet(request, '/tenant/compliance/history?days=30', token);
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const framework of Object.keys(body.frameworks || {})) {
      const history = body.frameworks[framework]?.history || [];
      expect(history.length).toBeLessThanOrEqual(30);
    }
  });

  test('no PII in response', async ({ request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to validate PII redaction checks.');

    const token = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    const res = await proxyGet(request, '/tenant/compliance/history', token);
    expect(res.status()).toBe(200);

    const raw = await res.text();
    if (TEST_EMAIL) {
      expect(raw.toLowerCase()).not.toContain(TEST_EMAIL.toLowerCase());
    }
    expect(raw).not.toContain('@');
    for (const commonName of ['john', 'jane', 'matthew', 'michael', 'sarah']) {
      expect(raw.toLowerCase()).not.toContain(`"${commonName}"`);
    }
  });
});

test.describe('Group 2: Portal UI — compliance score cards', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to run authenticated compliance UI tests.');
    const token = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    await seedTenantSession(page, token);
  });

  test('compliance page loads without error', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (/api|compliance|tenant\/compliance\/history/i.test(text)) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /compliance/i }).first()).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('score cards render for each framework', async ({ page }) => {
    await page.goto(`${PORTAL}/compliance`);
    await expect(page.getByText(/Compliance Score Trend/i)).toBeVisible();

    const cards = page.locator('div.rounded-xl.border.border-gray-200.bg-white.p-4');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const pageText = await page.textContent('body');
    expect(/SOC2|HIPAA|FedRAMP/.test(pageText || '')).toBeTruthy();
    expect(/\b(?:100|[1-9]?\d)\b/.test(pageText || '')).toBeTruthy();
    expect(/Passing|At Risk|Failing/.test(pageText || '')).toBeTruthy();
    expect(/Improving|Stable|Declining/.test(pageText || '')).toBeTruthy();
  });

  test('90-day trend chart renders', async ({ page }) => {
    await page.goto(`${PORTAL}/compliance`);

    const chartContainer = page.locator('text=Compliance Score Trend (90 Days)').locator('..').locator('..');
    await expect(chartContainer.locator('svg, canvas').first()).toBeVisible();
    await expect(chartContainer.locator('path, rect').first()).toBeVisible();
  });

  test('violation table renders', async ({ page }) => {
    await page.goto(`${PORTAL}/compliance`);

    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    await expect(table.locator('thead')).toContainText(/control/i);
    await expect(table.locator('thead')).toContainText(/severity/i);
    await expect(table.locator('tbody tr').first()).toBeVisible();
  });

  test('empty state renders when no data', async ({ page }) => {
    await page.route('**/tenant/compliance/history**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenant_id: 'tenant-test',
          generated_at: new Date().toISOString(),
          frameworks: {},
        }),
      });
    });

    await page.goto(`${PORTAL}/compliance`);
    await expect(page.getByText(/compliance score|02:00|no data/i)).toBeVisible();
  });
});

test.describe('Group 3: GET /api/admin/compliance/scores — admin API contract', () => {
  test('returns 200 with admin JWT', async ({ request }) => {
    test.skip(!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD, 'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to validate admin compliance API.');

    const token = await loginAndGetToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const res = await proxyGet(request, '/admin/compliance/scores', token);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('generated_at');
    expect(Array.isArray(body.tenants)).toBe(true);

    for (const tenant of body.tenants || []) {
      expect(tenant).toHaveProperty('tenant_id');
      const frameworksPresent = FRAMEWORKS.filter((fw) => tenant[fw] && typeof tenant[fw] === 'object');
      expect(frameworksPresent.length).toBeGreaterThan(0);
      for (const fw of frameworksPresent) {
        expect(typeof tenant[fw].score).toBe('number');
      }
    }
  });

  test('returns 401 with tenant JWT (non-admin)', async ({ request }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to validate non-admin access controls.');

    const tenantToken = await loginAndGetToken(request, TEST_EMAIL, TEST_PASSWORD);
    const res = await proxyGet(request, '/admin/compliance/scores', tenantToken);
    expect([401, 403]).toContain(res.status());
  });

  test('no real customer names/emails in response', async ({ request }) => {
    test.skip(!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD, 'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to validate PII checks for admin API.');

    const token = await loginAndGetToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const res = await proxyGet(request, '/admin/compliance/scores', token);
    expect(res.status()).toBe(200);

    const raw = await res.text();
    expect(raw).not.toContain('@');
  });
});

test.describe('Group 4: Netlify redirect — /api/tenant/compliance/history proxies correctly', () => {
  test('Netlify _redirects proxy is active', async ({ request }) => {
    const res = await request.get('https://portal.securebase.tximhotep.com/api/tenant/compliance/history');
    expect(res.status()).toBe(401);

    const body = (await res.text()).toLowerCase();
    expect(body).not.toContain('page not found');
    expect(body).not.toContain('cannot find');
    expect(body).not.toContain('netlify');
  });
});
