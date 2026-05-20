import { test, expect } from '@playwright/test';

/**
 * Compliance Scores UI E2E (mock-backed)
 *
 * Purpose:
 * - Validate compliance score UI states against deterministic mocked API payloads.
 * - Avoid dependence on live backend data for these assertions.
 *
 * Run locally:
 *   cd phase3a-portal
 *   BASE_URL=http://localhost:5173 npx playwright test tests/e2e/compliance-scores.spec.js --reporter=list
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('SecureBase - Compliance Scores E2E', () => {
  test('should display accurate compliance score states from the API', async ({ page }) => {
    await page.route('**/api/compliance/scores', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            overallScore: 94,
            frameworks: [
              { id: 'soc2', name: 'SOC 2 Type II', score: 96, status: 'compliant' },
              { id: 'ffiec', name: 'FFIEC', score: 88, status: 'attention_required' },
              { id: 'hipaa', name: 'HIPAA', score: 100, status: 'compliant' },
            ],
            lastUpdated: '2026-05-20T00:00:00.000Z',
          },
        }),
      });
    });

    await Promise.all([
      page.waitForResponse('**/api/compliance/scores'),
      page.goto(`${BASE_URL}/dashboard`),
    ]);

    const overallScoreCard = page.locator('[data-testid="overall-score-card"]');
    await expect(overallScoreCard).toBeVisible();
    await expect(overallScoreCard.locator('.score-display')).toContainText('94%');

    const ffiecRow = page.locator('[data-testid="framework-row-ffiec"]');
    await expect(ffiecRow).toBeVisible();
    await expect(ffiecRow.locator('.status-badge')).toContainText('Attention Required');

    const soc2Row = page.locator('[data-testid="framework-row-soc2"]');
    await expect(soc2Row).toBeVisible();
    await expect(soc2Row.locator('.score-display')).toContainText('96%');
    await expect(soc2Row.locator('.status-badge')).toContainText('Compliant');

    const hipaaRow = page.locator('[data-testid="framework-row-hipaa"]');
    await expect(hipaaRow).toBeVisible();
    await expect(hipaaRow.locator('.score-display')).toContainText('100%');
    await expect(hipaaRow.locator('.status-badge')).toContainText('Compliant');
  });
});

test.describe('SecureBase - Compliance Scores E2E (Failure Handling)', () => {
  test('should handle API failure degradation elegantly', async ({ page }) => {
    await page.route('**/api/compliance/scores', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await Promise.all([
      page.waitForResponse('**/api/compliance/scores'),
      page.goto(`${BASE_URL}/dashboard`),
    ]);
    await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);

    const errorBanner = page.locator('[data-testid="compliance-error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Unable to retrieve latest compliance metrics');
  });
});
