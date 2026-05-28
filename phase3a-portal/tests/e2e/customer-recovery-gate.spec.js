import { test, expect, request } from '@playwright/test';

const PORTAL = process.env.PORTAL_URL || 'https://portal.securebase.tximhotep.com';
const API = process.env.API_URL || 'https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod';
const RECOVERY_EMAIL = process.env.RECOVERY_CUSTOMER_EMAIL || process.env.SMOKE_EMAIL;
const RECOVERY_PASSWORD = process.env.RECOVERY_PASSWORD;
const RECOVERY_INVITE_TOKEN = process.env.RECOVERY_INVITE_TOKEN;
const RECOVERY_RESET_TOKEN = process.env.RECOVERY_RESET_TOKEN;
const COMPLIANCE_PATH = process.env.RECOVERY_COMPLIANCE_PATH || '/compliance';
const MANUAL_INVITE_CONFIRMED = process.env.RECOVERY_MANUAL_INVITE_CONFIRMED;

function requireEnv(name, value) {
  expect(value, `Missing required env var ${name}`).toBeTruthy();
}

function gateLog(message) {
  console.log(`[RECOVERY_GATE] ${message}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Customer recovery gate', () => {
  test('verifies onboarding recovery journey for one real customer', async ({ page }) => {
    test.setTimeout(120000);

    requireEnv('RECOVERY_CUSTOMER_EMAIL', RECOVERY_EMAIL);
    requireEnv('RECOVERY_PASSWORD', RECOVERY_PASSWORD);

    const ctx = await request.newContext();

    await test.step('invite available / accepted OR manual confirmation', async () => {
      if (RECOVERY_INVITE_TOKEN) {
        const acceptInviteRes = await ctx.post(`${API}/auth/accept-invite`, {
          data: { token: RECOVERY_INVITE_TOKEN, password: RECOVERY_PASSWORD },
        });
        expect(acceptInviteRes.status(), 'accept-invite must succeed').toBe(200);
        gateLog('✅ invite accepted via /auth/accept-invite');
        return;
      }

      if (RECOVERY_RESET_TOKEN) {
        const resetRes = await ctx.post(`${API}/auth/reset-password`, {
          data: { token: RECOVERY_RESET_TOKEN, password: RECOVERY_PASSWORD },
        });
        expect(resetRes.status(), 'reset-password must succeed').toBe(200);
        gateLog('✅ password reset path confirmed via /auth/reset-password');
        return;
      }

      expect(
        MANUAL_INVITE_CONFIRMED,
        'Set RECOVERY_INVITE_TOKEN or RECOVERY_RESET_TOKEN, or explicitly set RECOVERY_MANUAL_INVITE_CONFIRMED=true after manual verification'
      ).toBe('true');
      gateLog('⚠️ invite/password stage manually confirmed by operator');
    });

    await test.step('login works via auth API', async () => {
      const loginRes = await ctx.post(`${API}/auth/login`, {
        data: { email: RECOVERY_EMAIL, password: RECOVERY_PASSWORD },
      });
      expect(loginRes.status(), 'login must succeed').toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.token, 'login must return JWT').toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      gateLog('✅ login API succeeded');
    });

    await test.step('browser login lands in dashboard', async () => {
      await page.goto(`${PORTAL}/login`);
      await page.fill('#email', RECOVERY_EMAIL);
      await page.fill('#password', RECOVERY_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/dashboard/);
      gateLog('✅ browser login landed in dashboard');
    });

    await test.step('relevant compliance view loads', async () => {
      await page.goto(`${PORTAL}${COMPLIANCE_PATH}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(escapeRegex(COMPLIANCE_PATH)));
      await expect(page.locator('text=/compliance|hipaa|findings|controls/i').first()).toBeVisible({ timeout: 15000 });
      gateLog(`✅ compliance view loaded (${COMPLIANCE_PATH})`);
    });
  });
});
