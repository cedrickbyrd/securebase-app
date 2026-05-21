/**
 * Day 1 Customer Access Flow — Live API + Portal E2E
 *
 * Covers Day 1 customer access steps:
 *   1. POST /onboarding/trigger
 *   2. POST /auth (API key -> session JWT)
 *   3. GET  /users
 *   4. POST /support/tickets/create
 *   5. POST /webhooks
 *   6. GET  /reports
 *
 * Environment variables:
 *   PORTAL_URL     (optional, defaults to production portal URL)
 *   API_URL        (optional, defaults to live API Gateway URL)
 *   SMOKE_API_KEY  (required for authenticated happy-path steps)
 *   SMOKE_EMAIL    (optional, defaults to unique smoke email)
 *
 * Usage:
 *   npx playwright test tests/e2e/day1-access-flow.spec.js
 */

import { test, expect, request } from '@playwright/test';
import crypto from 'crypto';

const PORTAL = process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com';
const API = process.env.API_URL || 'https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod';
const SMOKE_API_KEY = process.env.SMOKE_API_KEY || '';
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || `day1-smoke-${Date.now()}@securebase.tximhotep.com`;

// Shared session token — populated by the happy-path Step 2 and consumed by
// the input-validation block.  Must live at module scope so both describe
// blocks can read/write it.
let sessionToken = '';

test.describe('Day 1 Access Flow — Auth Lambda (API contract)', () => {
  test('OPTIONS /auth returns 200 with CORS headers', async () => {
    const ctx = await request.newContext();
    const res = await ctx.fetch(`${API}/auth`, { method: 'OPTIONS' });
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBeTruthy();
    expect(headers['access-control-allow-methods']).toContain('POST');
  });

  test('POST /auth with missing Authorization returns 401', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/auth`);
    expect(res.status()).toBe(401);
  });

  test('POST /auth with invalid Bearer token returns 401', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/auth`, {
      headers: { Authorization: 'Bearer definitely_not_a_valid_api_key_or_jwt' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe.serial('Day 1 Access Flow — Happy Path (all 6 steps in sequence)', () => {
  test('Step 1: POST /onboarding/trigger succeeds for new customer', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/onboarding/trigger`, {
      data: {
        customer_id: crypto.randomUUID(),
        tier: 'fintech',
        email: SMOKE_EMAIL,
        name: 'Day1 Smoke',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('Step 2: POST /auth with API key returns session_token', async () => {
    test.skip(!SMOKE_API_KEY, 'Set SMOKE_API_KEY to run authenticated Day 1 happy-path steps.');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/auth`, {
      headers: { Authorization: `Bearer ${SMOKE_API_KEY || 'sb_smoketest_day1_key'}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.session_token).toBeTruthy();
    sessionToken = body.session_token;
  });

  test('Step 3: GET /users returns users array', async () => {
    test.skip(!sessionToken, 'Step 2 did not produce a session token; provide SMOKE_API_KEY.');

    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/users`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.users)).toBe(true);
  });

  test('Step 4: POST /support/tickets creates ticket and returns id', async () => {
    test.skip(!sessionToken, 'Step 2 did not produce a session token; provide SMOKE_API_KEY.');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/support/tickets/create`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        subject: 'Day 1 support smoke ticket',
        description: 'This is a live smoke test ticket for Day 1 customer access verification.',
        priority: 'medium',
        category: 'technical',
        email: SMOKE_EMAIL,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
  });

  test('Step 5: POST /webhooks registers webhook and returns id', async () => {
    test.skip(!sessionToken, 'Step 2 did not produce a session token; provide SMOKE_API_KEY.');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/webhooks`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        url: 'https://webhook.site/day1-smoke',
        events: ['ticket.created'],
        description: 'Day 1 smoke webhook registration',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.webhook?.id).toBeTruthy();
  });

  test('Step 6: GET /reports returns reports array', async () => {
    test.skip(!sessionToken, 'Step 2 did not produce a session token; provide SMOKE_API_KEY.');

    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/reports`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.reports)).toBe(true);
  });
});

test.describe('Day 1 Access Flow — Input Validation (API contract)', () => {
  test('POST /support/tickets/create with short subject returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/support/tickets/create`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        subject: 'abc',
        description: 'This description is intentionally long enough for validation checks.',
        priority: 'medium',
        category: 'technical',
        email: SMOKE_EMAIL,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /support/tickets/create with short description returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/support/tickets/create`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        subject: 'Valid Day 1 subject',
        description: 'too short',
        priority: 'medium',
        category: 'technical',
        email: SMOKE_EMAIL,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /support/tickets/create with invalid priority returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/support/tickets/create`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        subject: 'Valid Day 1 subject',
        description: 'This description is intentionally long enough for validation checks.',
        priority: 'urgent-impossible',
        category: 'technical',
        email: SMOKE_EMAIL,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /support/tickets/create with invalid category returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/support/tickets/create`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        subject: 'Valid Day 1 subject',
        description: 'This description is intentionally long enough for validation checks.',
        priority: 'medium',
        category: 'not-a-valid-category',
        email: SMOKE_EMAIL,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /webhooks with http:// URL returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/webhooks`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        url: 'http://example.com/webhook',
        events: ['ticket.created'],
        description: 'Invalid protocol validation check',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /webhooks with unknown event type returns 400', async () => {
    test.skip(!sessionToken, 'Set SMOKE_API_KEY to run input-validation tests (auth is enforced before field validation).');

    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/webhooks`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        url: 'https://example.com/webhook',
        events: ['ticket.unknown'],
        description: 'Unknown event validation check',
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Day 1 Access Flow — Portal Browser (SPA routes)', () => {
  test('/login loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${PORTAL}/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"], input[id="email"]').first()).toBeVisible();
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/users route loads (auth guard redirects unauthenticated users)', async ({ page }) => {
    await page.goto(`${PORTAL}/users`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/support route loads (auth guard redirects unauthenticated users)', async ({ page }) => {
    await page.goto(`${PORTAL}/support`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/reports route loads (auth guard redirects unauthenticated users)', async ({ page }) => {
    await page.goto(`${PORTAL}/reports`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/webhooks route loads (auth guard redirects unauthenticated users)', async ({ page }) => {
    await page.goto(`${PORTAL}/webhooks`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });
});
