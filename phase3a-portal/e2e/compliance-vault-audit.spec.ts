// phase3a-portal/e2e/compliance-vault-audit.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SecureBase Phase 6.5: Compliance Engine & Evidence Vault Flow', () => {
  test('compliance route loads and displays framework controls without runtime errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route(/.*api\.securebase\.tximhotep\.com\/api\/v1\/compliance\/history.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
        body: JSON.stringify({
          tenant: 'demo',
          overallScore: 98,
          timestamp: new Date().toISOString(),
          frameworks: {
            ffiec: { score: 98, passing: 42, total: 43 },
            soc2: { score: 100, passing: 64, total: 64 },
            hipaa: { score: 96, passing: 38, total: 40 },
          },
          controls: [
            {
              id: 'FFIEC-D-2-B',
              name: 'S3 Bucket Public Access Block & Object Lock Verification',
              framework: 'ffiec-cat',
              status: 'COMPLIANT',
              severity: 'HIGH',
            },
          ],
        }),
      });
    });

    await page.goto('/compliance?tenant=demo', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeVisible({ timeout: 15000 });

    const heading = page.getByRole('heading', { name: /compliance/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    const bodyText = await page.innerText('body');
    expect(bodyText).not.toMatch(/@cnboftexas\.com|@independent-bank\.com/i);
    expect(pageErrors).toEqual([]);
  });

  test('setup route renders account provisioning with validated session', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route('**/api/session/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          tenantId: 'tenant-sb-dogfood',
          role: 'compliance_officer',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      });
    });

    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    const setupContent = page.locator('text=/(Setup|Provisioning|Account|Organization|Connect)/i').first();
    await expect(setupContent).toBeVisible({ timeout: 15000 });

    expect(pageErrors).toEqual([]);
  });
});
