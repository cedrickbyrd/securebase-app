const { test, expect } = require('@playwright/test');

test.describe('SecureBase Stripe Integration', () => {
  
  test('Should redirect to Stripe Checkout for the White-Glove Pilot', async ({ page }) => {
    // 1. Visit the live marketing site
    await page.goto('https://tximhotep.com');
    
    // 2. Navigate to Pricing (verify the link works)
    const pricingLink = page.getByRole('link', { name: /pricing/i });
    await pricingLink.click();
    await expect(page).toHaveURL(/.*pricing/);

    // 3. Find the White-Glove Pilot/Fintech card and click purchase
    // Adjust the text to match your exact button label
    const buyButton = page.getByRole('button', { name: /get started|buy now|select/i }).last(); 
    
    // We expect a network request to your Lambda when clicked
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/checkout') && res.status() === 200),
      buyButton.click(),
    ]);

    const responseData = await response.json();
    console.log('✅ Lambda returned Stripe URL:', responseData.url);

    // 4. Verify the Handoff
    // Playwright will follow the window.location.href change
    await page.waitForURL(/.*checkout.stripe.com/);
    
    // Final check: Does the page actually say TxImhotep or SecureBase?
    await expect(page).toHaveTitle(/Stripe/);
    console.log('🚀 Successfully landed on Stripe Checkout page.');
  });
});
