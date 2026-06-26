import { test, expect } from '@playwright/test';

const FULFILLMENT_URL = '/marketplace-redirect';

test.describe('Marketplace Redirect Flow', () => {

  test('no token — shows invalid link error', async ({ page }) => {
    await page.goto(FULFILLMENT_URL);
    // Component sets error state to "Invalid marketplace link" but rewrites
    // it to this friendlier message before rendering (see MarketplaceRedirect.jsx)
    await expect(page.getByText(/Marketplace link has expired/i)).toBeVisible();
    await expect(page.getByText(/support@securebase\.tximhotep\.com/i)).toBeVisible();
  });

  test('valid token — activates and redirects to dashboard', async ({ page }) => {
    await page.route('**/marketplace/resolve', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Axios unwraps into response.data — mock the full axios shape
        body: JSON.stringify({
          customer_id: 'test-uuid-0001',
          redirect_url: '/dashboard',
          user: { email: 'buyer@testco.com', role: 'user' },
          token: 'mock-session-token-abc123',
        }),
      })
    );
    await page.goto(`${FULFILLMENT_URL}?x-amzn-marketplace-token=valid-test-token`);
    // Loading state may be brief — wait for URL change directly
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('invalid/expired token — shows token error', async ({ page }) => {
    await page.route('**/marketplace/resolve', route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_token',
          message: 'This subscription link has expired.',
        }),
      })
    );
    await page.goto(`${FULFILLMENT_URL}?x-amzn-marketplace-token=expired-token`);
    // Component shows err.message — match the actual error text
    await expect(page.getByText(/subscription link|expired|Unable to activate/i)).toBeVisible({ timeout: 8000 });
  });

  test('already subscribed — idempotent success', async ({ page }) => {
    await page.route('**/marketplace/resolve', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customer_id: 'existing-uuid-0002',
          redirect_url: '/dashboard',
          already_subscribed: true,
          token: 'mock-session-token-xyz456',
        }),
      })
    );
    await page.goto(`${FULFILLMENT_URL}?x-amzn-marketplace-token=existing-buyer-token`);
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('network error — shows support message', async ({ page }) => {
    await page.route('**/marketplace/resolve', route => route.abort('failed'));
    await page.goto(`${FULFILLMENT_URL}?x-amzn-marketplace-token=any-token`);
    // Support email is in an <a> tag — use locator that checks href or partial text
    await expect(
      page.locator('a[href*="support@"], a[href*="mailto"]').or(
        page.getByText(/Unable to activate|contact|support/i)
      )
    ).toBeVisible({ timeout: 8000 });
  });

});
