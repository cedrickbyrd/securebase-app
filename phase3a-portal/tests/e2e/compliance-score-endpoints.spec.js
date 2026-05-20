import { test, expect } from '@playwright/test';

const PORTAL = process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const FRAMEWORKS = ['SOC2', 'HIPAA', 'FedRAMP'];
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i;
const COMMON_NAME_PATTERN = /\b(john|jane|michael|sarah|matthew)\b/i;

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

/**
 * Phase 6.2 — Compliance score endpoints E2E spec
 *
 * Identity provisioning:
 *   Tenant A : e2e+tenantA@securebase.tximhotep.com  (PLAYWRIGHT_TEST_EMAIL)
 *   Admin    : e2e+admin@securebase.tximhotep.com    (PLAYWRIGHT_ADMIN_EMAIL)
 *   Tenant B : e2e+tenantB@securebase.tximhotep.com  (PLAYWRIGHT_TENANT_B_EMAIL)
 *
 * The backend, DB unique constraints, and auth provider must treat the full
 * string including +suffix as a distinct identity. Tests that require
 * credentials use test.skip() when passwords are absent so local runs without
 * secrets don't fail the suite.
 *
 * Run locally (Firefox only on Mac 10.15):
 *   cd phase3a-portal
 *   npx playwright test tests/e2e/compliance-score-endpoints.spec.js --reporter=list
 *
 * CI (all browsers):
 *   CI=true npx playwright test tests/e2e/compliance-score-endpoints.spec.js
 */

import { test, expect } from '@playwright/test';

const PORTAL    = process.env.PORTAL_URL        || 'https://portal.securebase.tximhotep.com';
const API       = process.env.API_URL           || 'https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod';

const tenantEmail   = process.env.TEST_EMAIL          || 'e2e+tenantA@securebase.tximhotep.com';
const tenantPass    = process.env.TEST_PASSWORD;
const adminEmail    = process.env.TEST_ADMIN_EMAIL    || 'e2e+admin@securebase.tximhotep.com';
const adminPass     = process.env.TEST_ADMIN_PASSWORD;

const credsMissing  = !tenantPass || !adminPass;

// ── Auth helper ────────────────────────────────────────────────────────────

async function getToken(request, email, password) {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  const body = await res.json();
  return body.token || body.accessToken || body.sessionToken;
}

// ── Group 1: GET /api/tenant/compliance/history — API contract ─────────────

test.describe('1 · Tenant compliance history API', () => {

  test('returns 401 without auth header', async ({ request }) => {
    const res = await request.get(`${PORTAL}/api/tenant/compliance/history`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with valid tenant JWT and correct shape', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const token = await getToken(request, tenantEmail, tenantPass);
    const res   = await request.get(`${PORTAL}/api/tenant/compliance/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    expect(raw).not.toMatch(EMAIL_PATTERN);
    expect(raw).not.toMatch(COMMON_NAME_PATTERN);
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

    const chartSurface = page.locator('svg.recharts-surface').first();
    await expect(chartSurface).toBeVisible();
    await expect(chartSurface.locator('path, rect').first()).toBeVisible();
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
    await expect(page.getByText(/compliance score|no data|daily calculation/i)).toBeVisible();
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
    expect(raw).not.toMatch(EMAIL_PATTERN);
  });
});

test.describe('Group 4: Netlify redirect — /api/tenant/compliance/history proxies correctly', () => {
  test('Netlify _redirects proxy is active', async ({ request }) => {
    const res = await request.get(`${PORTAL}/api/tenant/compliance/history`);
    expect(res.status()).toBe(401);

    const body = (await res.text()).toLowerCase();
    expect(body).not.toContain('page not found');
    expect(body).not.toContain('cannot find');
    expect(body).not.toContain('netlify');
  });
    const frameworks = Object.keys(body.frameworks);
    expect(frameworks.length).toBeGreaterThan(0);
    for (const fw of frameworks) {
      const f = body.frameworks[fw];
      expect(typeof f.current_score).toBe('number');
      expect(f.current_score).toBeGreaterThanOrEqual(0);
      expect(f.current_score).toBeLessThanOrEqual(100);
      expect(['Passing', 'At Risk', 'Failing']).toContain(f.status);
      expect(['Improving', 'Stable', 'Declining']).toContain(f.trend);
      expect(Array.isArray(f.history)).toBe(true);
      expect(Array.isArray(f.violations)).toBe(true);
    }
  });

  test('accepts ?framework=SOC2 and returns only SOC2', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const token = await getToken(request, tenantEmail, tenantPass);
    const res   = await request.get(`${PORTAL}/api/tenant/compliance/history?framework=SOC2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const keys = Object.keys(body.frameworks);
    expect(keys).toContain('SOC2');
    expect(keys.length).toBe(1);
  });

  test('accepts ?days=30 and returns ≤30 history entries', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const token = await getToken(request, tenantEmail, tenantPass);
    const res   = await request.get(`${PORTAL}/api/tenant/compliance/history?days=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const fw of Object.values(body.frameworks)) {
      expect(fw.history.length).toBeLessThanOrEqual(30);
    }
  });

  test('response contains no PII (no email addresses)', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const token = await getToken(request, tenantEmail, tenantPass);
    const res   = await request.get(`${PORTAL}/api/tenant/compliance/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await res.text();
    expect(raw).not.toMatch(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  });

});

// ── Group 2: Portal UI — compliance score cards ───────────────────────────

test.describe('2 · Compliance portal UI', () => {

  test('compliance page loads without API errors', async ({ page }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const errors = [];
    page.on('response', res => {
      if (res.url().includes('/compliance') && res.status() >= 500) {
        errors.push(`${res.status()} ${res.url()}`);
      }
    });
    await page.goto(`${PORTAL}/login`);
    await page.fill('#email', tenantEmail);
    await page.fill('#password', tenantPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|compliance)/, { timeout: 15000 });
    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('score cards render with framework names and numeric scores', async ({ page }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    await page.goto(`${PORTAL}/login`);
    await page.fill('#email', tenantEmail);
    await page.fill('#password', tenantPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|compliance)/, { timeout: 15000 });
    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');
    const hasFramework = await page.locator('text=/SOC2|HIPAA|FedRAMP/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasFramework, 'At least one framework score card should be visible').toBe(true);
    const statusVisible = await page.locator('text=/Passing|At Risk|Failing/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(statusVisible, 'Status badge should be visible').toBe(true);
  });

  test('90-day trend chart renders (SVG or canvas present)', async ({ page }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    await page.goto(`${PORTAL}/login`);
    await page.fill('#email', tenantEmail);
    await page.fill('#password', tenantPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|compliance)/, { timeout: 15000 });
    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');
    const chart = page.locator('svg, canvas').first();
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('violation table renders with severity column', async ({ page }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    await page.goto(`${PORTAL}/login`);
    await page.fill('#email', tenantEmail);
    await page.fill('#password', tenantPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|compliance)/, { timeout: 15000 });
    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');
    const severityHeader = await page.locator('text=/severity/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(severityHeader, 'Severity column header should be visible').toBe(true);
  });

  test('empty state renders when API returns no framework data', async ({ page }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    await page.route(`${PORTAL}/api/tenant/compliance/history`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tenant_id: 'test', generated_at: new Date().toISOString(), frameworks: {} }) })
    );
    await page.goto(`${PORTAL}/login`);
    await page.fill('#email', tenantEmail);
    await page.fill('#password', tenantPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|compliance)/, { timeout: 15000 });
    await page.goto(`${PORTAL}/compliance`);
    await page.waitForLoadState('networkidle');
    const emptyState = await page.locator('text=/compliance score|02:00|no data/i').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(emptyState, 'Empty state message should be visible when no data').toBe(true);
  });

});

// ── Group 3: GET /api/admin/compliance/scores — admin API contract ─────────

test.describe('3 · Admin compliance scores API', () => {

  test('returns 401 with tenant JWT (non-admin)', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_PASSWORD not set');
    const token = await getToken(request, tenantEmail, tenantPass);
    const res   = await request.get(`${PORTAL}/api/admin/compliance/scores`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('returns 200 with admin JWT and correct shape', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_ADMIN_PASSWORD not set');
    const token = await getToken(request, adminEmail, adminPass);
    const res   = await request.get(`${PORTAL}/api/admin/compliance/scores`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('generated_at');
    expect(Array.isArray(body.tenants)).toBe(true);
    for (const tenant of body.tenants) {
      expect(tenant).toHaveProperty('tenant_id');
      const hasScore = ['SOC2', 'HIPAA', 'FedRAMP'].some(fw => fw in tenant);
      expect(hasScore, `Tenant ${tenant.tenant_id} should have at least one framework score`).toBe(true);
    }
  });

  test('admin response contains no email addresses (PII check)', async ({ request }) => {
    test.skip(credsMissing, 'Skipping: TEST_ADMIN_PASSWORD not set');
    const token = await getToken(request, adminEmail, adminPass);
    const res   = await request.get(`${PORTAL}/api/admin/compliance/scores`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await res.text();
    expect(raw).not.toMatch(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  });

});

// ── Group 4: Netlify proxy — /api/tenant/compliance/history forwards ───────

test.describe('4 · Netlify proxy forwards compliance history endpoint', () => {

  test('GET /api/tenant/compliance/history without auth → 401 (proxy active, Lambda reached)', async ({ request }) => {
    const res = await request.get(`${PORTAL}/api/tenant/compliance/history`);
    expect(res.status(), 'Proxy should forward to Lambda — expect 401, not 404').toBe(401);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

});
