import { test, expect, chromium } from '@playwright/test';

test('Should redirect to Stripe Checkout', async () => {
  const browser = await chromium.launch({ 
    // This is the direct line to your local Chrome
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🚀 Starting Happy Path test...');
  await page.goto('https://tximhotep.com');
  
  // 1. Navigate to Pricing
  await page.click('text=Pricing');
  console.log('✅ Clicked Pricing');

  // 2. Click the Pilot button
  // We'll use a regex to find the button even if the text varies slightly
  await page.click('button:has-text(/Pilot|Get Started|Buy/i)');
  console.log('✅ Clicked Purchase - Waiting for Stripe...');

  // 3. Verify the Handoff
  // We wait for the URL to change to the Stripe domain
  await page.waitForURL(/.*checkout.stripe.com/, { timeout: 15000 });
  
  console.log('🔥 SUCCESS: Landed on Stripe URL:', page.url());
  
  // Pause for 3 seconds so you can see it before the browser closes
  await page.waitForTimeout(3000); 
  await browser.close();
});
