import { test, expect } from '@playwright/test';

test('app loads without runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('compliance dashboard route is reachable', async ({ page }) => {
  await page.goto('/compliance');
  await expect(page.getByRole('heading', { name: /compliance/i }).first()).toBeVisible();
});
