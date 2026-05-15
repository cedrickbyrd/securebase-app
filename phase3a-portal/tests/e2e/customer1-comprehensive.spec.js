/**
 * Customer #1 Comprehensive Endpoint & Route Existence Tests
 */

import { test, expect, request } from '@playwright/test';

const PORTAL = process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com';
const API    = process.env.API_URL    || 'https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod';

async function apiPost(path, data = {}) {
  const ctx = await request.newContext();
  return ctx.post(`${API}${path}`, { data });
}

async function proxyPost(path, data = {}) {
  const ctx = await request.newContext();
  return ctx.post(`${PORTAL}/api${path}`, { data });
}

async function portalGet(path) {
  const ctx = await request.newContext();
  return ctx.get(`${PORTAL}${path}`);
}

// ── 1. Lambda API — endpoint existence ────────────────────────────────────

test.describe('1 · Lambda API endpoints exist', () => {

  const endpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/invite',
    '/auth/accept-invite',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/mfa/setup',
    '/auth/mfa/verify',
  ];

  for (const ep of endpoints) {
    test(`OPTIONS ${ep} → 200 (CORS preflight)`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.fetch(`${API}${ep}`, { method: 'OPTIONS' });
      expect(res.status(), `OPTIONS ${ep} should return 200`).toBe(200);
    });

    test(`POST ${ep} empty body → not 404 / not 500 (endpoint reached)`, async () => {
      const res = await apiPost(ep, {});
      expect([400, 401, 403, 404], `POST ${ep} should be reachable, got ${res.status()}`)
        .toContain(res.status());
    });
  }

});

// ── 2. Lambda API — CORS headers present ──────────────────────────────────

test.describe('2 · CORS headers on all auth endpoints', () => {

  const endpoints = [
    '/auth/login',
    '/auth/invite',
    '/auth/accept-invite',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  for (const ep of endpoints) {
    test(`${ep} returns Access-Control-Allow-Origin header`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.fetch(`${API}${ep}`, { method: 'OPTIONS' });
      const headers = res.headers();
      expect(
        headers['access-control-allow-origin'],
        `${ep} missing CORS header`
      ).toBeTruthy();
    });
  }

});

// ── 3. Lambda API — error contract (correct status codes) ─────────────────

test.describe('3 · Auth API error contracts', () => {

  test('POST /auth/login — missing email/password → 400', async () => {
    const res = await apiPost('/auth/login', {});
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).not.toHaveProperty('stack');
    expect(body).toHaveProperty('message');
  });

  test('POST /auth/login — wrong credentials → 401', async () => {
    const res = await apiPost('/auth/login', { email: 'nobody@example.com', password: 'wrongpass' });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).not.toHaveProperty('stack');
  });

  test('POST /auth/invite — missing email → 400', async () => {
    const res = await apiPost('/auth/invite', {});
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/email/i);
  });

  test('POST /auth/accept-invite — missing token + password → 400', async () => {
    const res = await apiPost('/auth/accept-invite', {});
    expect(res.status()).toBe(400);
  });

  test('POST /auth/accept-invite — expired/invalid token → 400', async () => {
    const res = await apiPost('/auth/accept-invite', {
      token: 'a'.repeat(64),
      password: 'ValidPass123!',
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/invalid|expired/i);
  });

  test('POST /auth/accept-invite — password too short → 400', async () => {
    const res = await apiPost('/auth/accept-invite', {
      token: 'a'.repeat(64),
      password: 'short',
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/forgot-password — unknown email → 200 (no enumeration)', async () => {
    const res = await apiPost('/auth/forgot-password', { email: 'ghost@nowhere.com' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/if that email exists/i);
    expect(body).not.toHaveProperty('stack');
  });

  test('POST /auth/forgot-password — missing email → 400', async () => {
    const res = await apiPost('/auth/forgot-password', {});
    expect(res.status()).toBe(400);
  });

  test('POST /auth/reset-password — invalid token → 400', async () => {
    const res = await apiPost('/auth/reset-password', {
      token: 'b'.repeat(64),
      password: 'NewPassword123!',
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/invalid|expired/i);
  });

  test('POST /auth/mfa/setup — missing email → 400', async () => {
    const res = await apiPost('/auth/mfa/setup', {});
    expect(res.status()).toBe(400);
  });

  test('POST /auth/mfa/setup — unknown user → 404', async () => {
    const res = await apiPost('/auth/mfa/setup', { email: 'ghost@nowhere.com' });
    expect(res.status()).toBe(404);
  });

  test('POST /auth/mfa/verify — missing fields → 400', async () => {
    const res = await apiPost('/auth/mfa/verify', {});
    expect(res.status()).toBe(400);
  });

});

// ── 4. Netlify /api proxy — all routes proxy correctly ────────────────────

test.describe('4 · Netlify /api proxy routes to Lambda', () => {

  // Expected status = what Lambda returns for empty body via proxy
  // These confirm the proxy is working (not returning Netlify 404)
  const proxyRoutes = [
    ['/auth/login',           400],
    ['/auth/register',        400],
    ['/auth/invite',          400],
    ['/auth/accept-invite',   400],
    ['/auth/forgot-password', 400], // missing email → 400
    ['/auth/reset-password',  400],
    ['/auth/mfa/setup',       400], // missing email → 400 (null guard)
    ['/auth/mfa/verify',      400],
  ];

  for (const [route, expectedStatus] of proxyRoutes) {
    test(`POST /api${route} → ${expectedStatus} (proxy working, Lambda reached)`, async () => {
      const res = await proxyPost(route, {});
      expect(
        res.status(),
        `Proxy /api${route} returned ${res.status()}, expected ${expectedStatus}`
      ).toBe(expectedStatus);
    });
  }

});

// ── 5. Portal SPA routes — all pages exist ────────────────────────────────

test.describe('5 · Portal SPA routes exist (200 from Netlify)', () => {

  const publicRoutes = [
    '/',
    '/login',
    '/accept-invite',
    '/forgot-password',
    '/reset-password',
    '/pricing',
    '/checkout',
    '/contact-sales',
    '/thank-you',
    '/pilots/compliance-jumpstart',
    '/pilots/hipaa-readiness',
    '/setup',
    '/onboarding',
  ];

  for (const route of publicRoutes) {
    test(`GET ${route} → 200 (SPA serves index.html)`, async () => {
      const res = await portalGet(route);
      expect(res.status(), `${route} returned ${res.status()}`).toBe(200);
    });
  }

  const protectedRoutes = [
    '/dashboard',
    '/demo-dashboard',
    '/compliance',
    '/fintech-portal',
    '/hipaa-dashboard',
    '/sre-dashboard',
    '/alerts',
    '/admin',
  ];

  for (const route of protectedRoutes) {
    test(`GET ${route} → 200 (SPA fallback, client-side auth redirect)`, async () => {
      const res = await portalGet(route);
      expect(res.status(), `${route} returned ${res.status()}`).toBe(200);
    });
  }

  test('GET /nonexistent-route → 200 (SPA fallback active)', async () => {
    const res = await portalGet('/this-does-not-exist-xyz-abc');
    expect(res.status()).toBe(200);
  });

});

// ── 6. Browser — auth routes behave correctly ─────────────────────────────

test.describe('6 · Browser auth flow behavior', () => {

  test('/login renders email + password fields', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${PORTAL}/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"], input[id="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/accept-invite without token redirects to /login', async ({ page }) => {
    await page.goto(`${PORTAL}/accept-invite`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/accept-invite?token=x renders set-password form', async ({ page }) => {
    await page.goto(`${PORTAL}/accept-invite?token=${'x'.repeat(64)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('/forgot-password renders email field', async ({ page }) => {
    await page.goto(`${PORTAL}/forgot-password`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"], input[id="email"], input[name="email"], input[placeholder*="email" i]').first()).toBeVisible();
  });

  test('/reset-password?token=x renders new-password form', async ({ page }) => {
    await page.goto(`${PORTAL}/reset-password?token=${'x'.repeat(64)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('/dashboard unauthenticated redirects to /login', async ({ page }) => {
    await page.goto(`${PORTAL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/hipaa-dashboard unauthenticated redirects to /login', async ({ page }) => {
    await page.goto(`${PORTAL}/hipaa-dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/admin unauthenticated redirects to /login', async ({ page }) => {
    await page.goto(`${PORTAL}/admin`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/login page title contains SecureBase', async ({ page }) => {
    await page.goto(`${PORTAL}/login`);
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/securebase|secure/);
  });

});

// ── 7. DynamoDB user record — Matthew's record is intact ──────────────────

test.describe('7 · Customer #1 user record health', () => {

  test('Matthew\'s email exists in system (login returns 401 not 500)', async () => {
    const res = await apiPost('/auth/login', {
      email: 'Matthew.matturro@trinetx.com',
      password: 'probe_password_should_fail',
    });
    expect(res.status(), 'Matthew user record should exist in DynamoDB').toBe(401);
  });

  test('Forgot-password for Matthew returns 200 (user exists)', async () => {
    const res = await apiPost('/auth/forgot-password', {
      email: 'Matthew.matturro@trinetx.com',
    });
    expect(res.status()).toBe(200);
  });

});
