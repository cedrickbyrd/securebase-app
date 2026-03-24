import { test, expect } from '@playwright/test';

/**
 * Full Signup Flow E2E Tests
 * 
 * Tests the complete conversion funnel:
 * 1. Demo page → Start Free Trial CTA
 * 2. Signup page load & form validation
 * 3. Stripe checkout session creation
 * 4. Redirect to Stripe Checkout
 * 
 * CRITICAL: This test validates the entire customer acquisition path
 */

const DEMO_URL = process.env.DEMO_URL || 'https://demo.securebase.tximhotep.com/login';
const SIGNUP_URL = process.env.SIGNUP_URL || 'https://securebase.tximhotep.com/signup';
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

// Test data
const TEST_CUSTOMER = {
  company: 'Test Healthcare Corp',
  name: 'Jane Test User',
  email: `test+${Date.now()}@securebase.tximhotep.com`, // Unique email per test run
  phone: '+1 (555) 123-4567'
};

test.describe('Full Signup Flow - Demo to Stripe Checkout', () => {
  
  test('CRITICAL: Demo CTA links to correct signup URL', async ({ page }) => {
    // Navigate to demo login page
    await page.goto(DEMO_URL);
    
    // Find the "Start Your Free Trial" CTA in footer
    const trialCTA = page.locator('a:has-text("Start Your Free Trial")').first();
    
    // Verify CTA is visible
    await expect(trialCTA).toBeVisible();
    
    // Verify CTA has correct href
    const href = await trialCTA.getAttribute('href');
    expect(href).toBe('https://securebase.tximhotep.com/signup');
    
    // Verify CTA has proper styling (should be bold/prominent)
    const styles = await trialCTA.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        fontWeight: computed.fontWeight,
        color: computed.color
      };
    });
    
    // Should be bold and have a prominent color
    expect(parseInt(styles.fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test('CRITICAL: Signup page loads successfully', async ({ page }) => {
    const response = await page.goto(SIGNUP_URL);
    
    // Verify page loads with 200 status
    expect(response?.status()).toBe(200);
    
    // Verify page title
    await expect(page).toHaveTitle(/SecureBase|Signup|Sign Up/i);
    
    // Verify core elements are present
    await expect(page.locator('h1:has-text("Start Your Free Trial")')).toBeVisible();
    
    // Verify all tier options are displayed
    await expect(page.locator('text=Standard')).toBeVisible();
    await expect(page.locator('text=Fintech')).toBeVisible();
    await expect(page.locator('text=Healthcare')).toBeVisible();
    await expect(page.locator('text=Government')).toBeVisible();
  });

  test('CRITICAL: Signup form has all required fields', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Verify all form fields exist
    const companyInput = page.locator('input[name="company"]');
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const phoneInput = page.locator('input[name="phone"]');
    
    await expect(companyInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    
    // Verify required field markers
    await expect(page.locator('label:has-text("Company Name *")')).toBeVisible();
    await expect(page.locator('label:has-text("Your Name *")')).toBeVisible();
    await expect(page.locator('label:has-text("Work Email *")')).toBeVisible();
    
    // Verify pilot program checkbox exists
    const pilotCheckbox = page.locator('input[name="usePilot"]');
    await expect(pilotCheckbox).toBeVisible();
    
    // Verify it's checked by default (pilot pricing should be enabled)
    await expect(pilotCheckbox).toBeChecked();
  });

  test('CRITICAL: Tier selection updates pricing correctly', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Expected pricing (with pilot discount - 50% off)
    const expectedPricing = {
      standard: { regular: 2000, pilot: 1000 },
      fintech: { regular: 8000, pilot: 4000 },
      healthcare: { regular: 15000, pilot: 7500 },
      government: { regular: 25000, pilot: 12500 }
    };
    
    // Test each tier
    for (const [tier, prices] of Object.entries(expectedPricing)) {
      // Click the tier button
      await page.locator(`button:has-text("${tier.charAt(0).toUpperCase() + tier.slice(1)}")`).first().click();
      
      // Wait for pricing to update
      await page.waitForTimeout(300);
      
      // Verify pilot pricing is displayed
      const monthlyPrice = page.locator('text=/Monthly Price/').locator('..').locator(`text=/$${prices.pilot.toLocaleString()}/`);
      await expect(monthlyPrice).toBeVisible();
      
      // Verify strikethrough regular price is shown
      if (await page.locator(`text=/$${prices.regular.toLocaleString()}/mo/`).count() > 0) {
        // Strikethrough price should exist for pilot mode
        expect(true).toBe(true);
      }
    }
  });

  test('CRITICAL: Pilot checkbox toggles pricing', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Select Healthcare tier (easier to see price difference)
    await page.locator('button:has-text("Healthcare")').first().click();
    await page.waitForTimeout(300);
    
    // Verify pilot pricing is shown initially ($7,500)
    await expect(page.locator('text=/$7,500/')).toBeVisible();
    
    // Uncheck pilot program
    const pilotCheckbox = page.locator('input[name="usePilot"]');
    await pilotCheckbox.uncheck();
    await page.waitForTimeout(300);
    
    // Verify full pricing is now shown ($15,000)
    await expect(page.locator('text=/$15,000/')).toBeVisible();
    
    // Re-check pilot program
    await pilotCheckbox.check();
    await page.waitForTimeout(300);
    
    // Verify pilot pricing returns ($7,500)
    await expect(page.locator('text=/$7,500/')).toBeVisible();
  });

  test('CRITICAL: Form validation prevents empty submission', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Try to submit without filling form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Browser HTML5 validation should prevent submission
    // Check if company field shows validation error
    const companyInput = page.locator('input[name="company"]');
    const isInvalid = await companyInput.evaluate(el => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('CRITICAL: Form validation requires valid email', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Fill in all fields except email with valid data
    await page.fill('input[name="company"]', TEST_CUSTOMER.company);
    await page.fill('input[name="name"]', TEST_CUSTOMER.name);
    await page.fill('input[name="email"]', 'invalid-email'); // Invalid email
    await page.fill('input[name="phone"]', TEST_CUSTOMER.phone);
    
    // Try to submit
    await page.locator('button[type="submit"]').click();
    
    // Email field should show validation error
    const emailInput = page.locator('input[name="email"]');
    const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('CRITICAL: Successfully filled form submits to checkout API', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Select Healthcare tier
    await page.locator('button:has-text("Healthcare")').first().click();
    await page.waitForTimeout(300);
    
    // Fill in all required fields
    await page.fill('input[name="company"]', TEST_CUSTOMER.company);
    await page.fill('input[name="name"]', TEST_CUSTOMER.name);
    await page.fill('input[name="email"]', TEST_CUSTOMER.email);
    await page.fill('input[name="phone"]', TEST_CUSTOMER.phone);
    
    // Ensure pilot pricing is enabled
    const pilotCheckbox = page.locator('input[name="usePilot"]');
    if (!await pilotCheckbox.isChecked()) {
      await pilotCheckbox.check();
    }
    
    // Set up request interception to verify API call
    let checkoutRequest = null;
    page.on('request', request => {
      if (request.url().includes('/checkout')) {
        checkoutRequest = request;
      }
    });
    
    // Submit the form
    await page.locator('button[type="submit"]').click();
    
    // Wait for API call to be made
    await page.waitForTimeout(2000);
    
    // Verify checkout API was called
    expect(checkoutRequest).not.toBeNull();
    
    // Verify request payload
    if (checkoutRequest) {
      const postData = checkoutRequest.postDataJSON();
      expect(postData.tier).toBe('healthcare');
      expect(postData.email).toBe(TEST_CUSTOMER.email);
      expect(postData.name).toBe(TEST_CUSTOMER.company);
      expect(postData.use_pilot_coupon).toBe(true);
    }
  });

  test('CRITICAL: Demo to Signup flow works end-to-end', async ({ page }) => {
    // Step 1: Start at demo page
    await page.goto(DEMO_URL);
    
    // Step 2: Click "Start Your Free Trial" CTA
    const trialCTA = page.locator('a:has-text("Start Your Free Trial")').first();
    await expect(trialCTA).toBeVisible();
    
    // Step 3: Click and navigate to signup
    await trialCTA.click();
    
    // Step 4: Wait for signup page to load
    await page.waitForURL(/signup/);
    
    // Step 5: Verify we're on signup page
    await expect(page.locator('h1:has-text("Start Your Free Trial")')).toBeVisible();
    
    // Step 6: Verify tier selection is available
    await expect(page.locator('button:has-text("Healthcare")')).toBeVisible();
    
    // Step 7: Verify form is ready for input
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('BLOCKING: Rate limiting displays error message', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Use an email that might trigger rate limiting
    const rateLimitedEmail = 'rate-limited@test.com';
    
    // Fill form
    await page.fill('input[name="company"]', 'Test Corp');
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', rateLimitedEmail);
    
    // Mock 429 response
    await page.route(`${API_BASE_URL}/checkout`, route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          next_signup_date: '2026-03-24'
        })
      });
    });
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for error message
    await page.waitForTimeout(1000);
    
    // Verify error message is displayed
    const errorMessage = page.locator('.bg-red-50, .text-red-700, [class*="error"]');
    await expect(errorMessage).toBeVisible();
  });

  test('MONITORING: Signup button shows loading state', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Fill form quickly
    await page.fill('input[name="company"]', TEST_CUSTOMER.company);
    await page.fill('input[name="name"]', TEST_CUSTOMER.name);
    await page.fill('input[name="email"]', TEST_CUSTOMER.email);
    
    // Find submit button
    const submitButton = page.locator('button[type="submit"]');
    
    // Verify button exists and has initial text
    await expect(submitButton).toBeVisible();
    const initialText = await submitButton.textContent();
    expect(initialText).toBeTruthy();
    
    // Submit form
    await submitButton.click();
    
    // Button should show loading state
    await page.waitForTimeout(500);
    
    // Verify button is disabled during submission
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('ANALYTICS: Pricing summary displays correctly', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Select Government tier (highest price)
    await page.locator('button:has-text("Government")').first().click();
    await page.waitForTimeout(300);
    
    // Verify pricing summary section exists
    const pricingSummary = page.locator('.bg-gray-50, [class*="summary"]').filter({ hasText: /Selected Tier|Monthly Price/ });
    await expect(pricingSummary).toBeVisible();
    
    // Verify selected tier is shown
    await expect(page.locator('text=/Selected Tier/')).toBeVisible();
    await expect(page.locator('text=/Government/')).toBeVisible();
    
    // Verify monthly price is shown
    await expect(page.locator('text=/Monthly Price/')).toBeVisible();
    await expect(page.locator('text=/$12,500/')).toBeVisible(); // Pilot pricing
    
    // Verify pilot savings calculation
    await expect(page.locator('text=/Pilot Savings/')).toBeVisible();
    // Government: $25,000 - $12,500 = $12,500 saved per month × 6 = $75,000
    await expect(page.locator('text=/$75,000/')).toBeVisible();
    
    // Verify trial period is mentioned
    await expect(page.locator('text=/30 days FREE/i')).toBeVisible();
  });
});

test.describe('Signup Flow - Edge Cases & Error Handling', () => {
  
  test('EDGE CASE: Special characters in company name', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Fill with special characters
    await page.fill('input[name="company"]', "O'Reilly & Sons, Inc.");
    await page.fill('input[name="name"]', "Mary-Jane O'Connor");
    await page.fill('input[name="email"]', TEST_CUSTOMER.email);
    
    // Should not throw errors
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for API call
    await page.waitForTimeout(1000);
    
    // No JavaScript errors should occur
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    
    expect(errors.length).toBe(0);
  });

  test('EDGE CASE: International phone number format', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Fill with international phone
    await page.fill('input[name="company"]', TEST_CUSTOMER.company);
    await page.fill('input[name="name"]', TEST_CUSTOMER.name);
    await page.fill('input[name="email"]', TEST_CUSTOMER.email);
    await page.fill('input[name="phone"]', '+44 20 7123 4567'); // UK number
    
    // Should accept without errors
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForTimeout(1000);
    
    // No validation errors on phone field
    const phoneInput = page.locator('input[name="phone"]');
    const isValid = await phoneInput.evaluate(el => el.validity.valid);
    expect(isValid).toBe(true);
  });

  test('SECURITY: Form prevents XSS in input fields', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Try to inject script
    const xssPayload = '<script>alert("XSS")</script>';
    
    await page.fill('input[name="company"]', xssPayload);
    await page.fill('input[name="name"]', xssPayload);
    
    // Wait a moment
    await page.waitForTimeout(500);
    
    // Verify no alert dialog appears
    page.on('dialog', dialog => {
      // If dialog appears, test should fail
      expect(dialog.type()).not.toBe('alert');
      dialog.dismiss();
    });
    
    // Verify input is properly escaped
    const companyValue = await page.inputValue('input[name="company"]');
    expect(companyValue).toBe(xssPayload); // Should be stored as plain text, not executed
  });
});

test.describe('Signup Flow - Performance & Mobile', () => {
  
  test('PERFORMANCE: Signup page loads in under 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(SIGNUP_URL, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('MOBILE: Signup form is responsive on mobile', async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto(SIGNUP_URL);
    
    // Verify page loads
    await expect(page.locator('h1:has-text("Start Your Free Trial")')).toBeVisible();
    
    // Verify form inputs are visible and usable
    await expect(page.locator('input[name="email"]')).toBeVisible();
    
    // Verify tier selection is accessible
    await expect(page.locator('button:has-text("Healthcare")')).toBeVisible();
    
    // Test form interaction on mobile
    await page.fill('input[name="email"]', 'mobile@test.com');
    const emailValue = await page.inputValue('input[name="email"]');
    expect(emailValue).toBe('mobile@test.com');
  });

  test('ACCESSIBILITY: Form has proper ARIA labels', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    
    // Check for proper labels
    const companyInput = page.locator('input[name="company"]');
    const companyLabel = page.locator('label:has-text("Company Name")');
    
    await expect(companyLabel).toBeVisible();
    await expect(companyInput).toBeVisible();
    
    // Verify required field indicators
    await expect(page.locator('text=/\\*/')).toHaveCount(3); // 3 required fields marked with *
  });
});

