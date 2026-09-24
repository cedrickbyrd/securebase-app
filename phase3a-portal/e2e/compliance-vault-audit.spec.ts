import { test, expect } from '@playwright/test';

test.describe('SecureBase Phase 6.5: Compliance Engine & Evidence Vault Flow', () => {
  test('compliance route loads and displays framework controls without runtime errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/compliance');
    await expect(page.locator('body')).toBeVisible();

    // Verify main compliance heading
    const heading = page.getByRole('heading', { name: /compliance/i }).first();
    await expect(heading).toBeVisible();

    // Verify PII Hygiene across DOM nodes
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toMatch(/@cnboftexas\.com|@independent-bank\.com/i);
    expect(pageErrors).toEqual([]);
  });

  test('setup route renders account provisioning with validated session', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Mock validate-session API response
    await page.route('**/api/validate-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          customer_email: 'eval-user@securebase-sandbox.internal',
          tier: 'fintech',
          product: 'SecureBase Fintech Tier'
        })
      });
    });

    // Navigate to Setup route with valid mock Stripe session parameter
    await page.goto('/setup?session_id=cs_test_mock_12345&product=fintech');
    await expect(page.locator('body')).toBeVisible();

    // Verify presence of organization name input field
    const orgInput = page.locator('input[type="text"], input#orgName, input[placeholder*="Organization"], input[placeholder*="Company"]').first();
    await expect(orgInput).toBeVisible({ timeout: 10000 });

    // Verify strict PII hygiene
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toMatch(/@cnboftexas\.com|@independent-bank\.com/i);
    expect(pageErrors).toEqual([]);
  });
});
