const { test, expect } = require('@playwright/test');

test.describe('Add-On Products — Pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('Add-On Products section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Add-On Products' })).toBeVisible();
  });

  test('Compliance Jumpstart card shows correct price and badge', async ({ page }) => {
    await expect(page.getByText('Compliance Jumpstart')).toBeVisible();
    await expect(page.getByText('$495')).toBeVisible();
    await expect(page.getByText('One-time purchase').first()).toBeVisible();
  });

  test('HIPAA Readiness Assessment card shows correct price and badge', async ({ page }) => {
    await expect(page.getByText('HIPAA Readiness Assessment')).toBeVisible();
    await expect(page.getByText('$1,995')).toBeVisible();
  });

  test('Compliance Jumpstart CTA navigates to correct checkout URL', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/plan=pilot_compliance/);
    await expect(page).toHaveURL(/planName=Compliance%20Jumpstart/);
  });

  test('HIPAA Assessment CTA navigates to correct checkout URL', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Assessment' }).click();
    await expect(page).toHaveURL(/plan=hipaa_assessment/);
    await expect(page).toHaveURL(/planName=HIPAA%20Readiness%20Assessment/);
  });
});

test.describe('Checkout — one-time payment plan rendering', () => {
  test('pilot_compliance shows "Complete your purchase" and "one-time"', async ({ page }) => {
    await page.goto('/checkout?plan=pilot_compliance&planName=Compliance%20Jumpstart');
    await expect(page.getByRole('heading', { name: 'Complete your purchase' })).toBeVisible();
    await expect(page.getByText('one-time')).toBeVisible();
    await expect(page.getByText('/month')).not.toBeVisible();
  });

  test('hipaa_assessment shows HIPAA BAA consent checkbox and company field', async ({ page }) => {
    await page.goto('/checkout?plan=hipaa_assessment&planName=HIPAA%20Readiness%20Assessment');
    await expect(page.locator('#checkout-hipaa-baa')).toBeVisible();
    await expect(page.locator('#checkout-company')).toBeVisible();
  });
});
