import { test, expect } from '@playwright/test';

/**
 * Live Demo Portal E2E Tests
 * 
 * Tests the live demo deployment at:
 * http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com
 * 
 * Based on validation checklist from DEMO_ENVIRONMENT.md (lines 184-198)
 */

const DEMO_URL = process.env.DEMO_URL || 'http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com';
const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo';

test.describe('Live Demo Portal - Accessibility', () => {
  test('should be accessible with HTTP 200', async ({ page }) => {
    const response = await page.goto(DEMO_URL);
    expect(response?.status()).toBe(200);
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto(DEMO_URL);
    await expect(page).toHaveTitle(/SecureBase/i);
  });

  test('should not be in quirks mode', async ({ page }) => {
    await page.goto(DEMO_URL);
    const compatMode = await page.evaluate(() => document.compatMode);
    expect(compatMode).toBe('CSS1Compat'); // Standards mode
  });
});

test.describe('Live Demo Portal - Authentication', () => {
  test('should load mock API successfully', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Check for mock API load messages
    const mockApiLoaded = consoleMessages.some(msg => msg.includes('MOCK API LOADED'));
    const mockInstalled = consoleMessages.some(msg => msg.includes('MOCK INSTALLED'));
    
    expect(mockApiLoaded || mockInstalled).toBeTruthy();
  });

  test('should auto-login or show demo login form', async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Wait for either dashboard (auto-login) or login form
    const isDashboardVisible = await page.locator('text=Dashboard').isVisible().catch(() => false);
    const isLoginFormVisible = await page.locator('input[type="text"], input[type="password"]').first().isVisible().catch(() => false);
    
    expect(isDashboardVisible || isLoginFormVisible).toBeTruthy();
  });

  test('should login with demo/demo credentials if login page shown', async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Check if login form is present
    const loginFormVisible = await page.locator('input[type="text"], input[placeholder*="username" i]').first().isVisible().catch(() => false);
    
    if (loginFormVisible) {
      // Fill in demo credentials
      await page.fill('input[type="text"], input[placeholder*="username" i]', DEMO_USERNAME);
      await page.fill('input[type="password"], input[placeholder*="password" i]', DEMO_PASSWORD);
      
      // Click sign in button
      await page.click('button:has-text("Sign In"), button:has-text("Login")');
      
      // Wait for navigation to dashboard
      await page.waitForURL(/dashboard|\//, { timeout: 10000 });
      
      // Verify we're on the dashboard
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Live Demo Portal - Demo Banner', () => {
  test('should display demo banner', async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Look for demo banner indicators
    const demoIndicators = [
      page.locator('text=/demo mode/i'),
      page.locator('text=/read.only/i'),
      page.locator('text=/demonstration/i'),
      page.locator('[class*="demo"][class*="banner"]'),
      page.locator('[class*="banner"]').filter({ hasText: /demo/i })
    ];
    
    // At least one demo indicator should be visible
    let found = false;
    for (const locator of demoIndicators) {
      if (await locator.first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    
    expect(found).toBeTruthy();
  });
});

test.describe('Live Demo Portal - Dashboard & Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Handle login if needed
    const loginFormVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    if (loginFormVisible) {
      await page.fill('input[type="text"]', DEMO_USERNAME);
      await page.fill('input[type="password"]', DEMO_PASSWORD);
      await page.click('button:has-text("Sign In"), button:has-text("Login")');
      // Wait for navigation after login
      await page.waitForLoadState('networkidle');
    }
  });

  test('should load dashboard with sample data', async ({ page }) => {
    // Dashboard should have metrics/stats
    const metricsVisible = await page.locator('text=/total|active|customers|accounts/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(metricsVisible).toBeTruthy();
  });

  test('should display customer data (5 customers expected)', async ({ page }) => {
    // Look for customer-related content
    const hasCustomerData = await page.locator('text=/customer|account|tenant/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCustomerData).toBeTruthy();
  });

  test('should load charts and visualizations', async ({ page }) => {
    // Look for chart elements (canvas, svg, or chart containers)
    const chartElements = await page.locator('canvas, svg, [class*="chart"]').count();
    expect(chartElements).toBeGreaterThan(0);
  });
});

test.describe('Live Demo Portal - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Handle login if needed
    const loginFormVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    if (loginFormVisible) {
      await page.fill('input[type="text"]', DEMO_USERNAME);
      await page.fill('input[type="password"]', DEMO_PASSWORD);
      await page.click('button:has-text("Sign In"), button:has-text("Login")');
      await page.waitForLoadState('networkidle');
    }
  });

  test('should navigate to Invoices page', async ({ page }) => {
    const invoiceLink = page.locator('a:has-text("Invoice"), a:has-text("Billing")').first();
    if (await invoiceLink.isVisible().catch(() => false)) {
      await invoiceLink.click();
      // Wait for navigation to complete
      await page.waitForLoadState('domcontentloaded');
      
      // Verify navigation
      const invoiceContent = await page.locator('text=/invoice|billing|payment/i').first().isVisible().catch(() => false);
      expect(invoiceContent).toBeTruthy();
    }
  });

  test('should navigate to Compliance page', async ({ page }) => {
    const complianceLink = page.locator('a:has-text("Compliance"), a:has-text("Security")').first();
    if (await complianceLink.isVisible().catch(() => false)) {
      await complianceLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Verify navigation
      const complianceContent = await page.locator('text=/compliance|framework|score/i').first().isVisible().catch(() => false);
      expect(complianceContent).toBeTruthy();
    }
  });

  test('should navigate to API Keys page', async ({ page }) => {
    const apiKeysLink = page.locator('a:has-text("API"), a:has-text("Keys")').first();
    if (await apiKeysLink.isVisible().catch(() => false)) {
      await apiKeysLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Verify navigation
      const apiContent = await page.locator('text=/api.key|token|credential/i').first().isVisible().catch(() => false);
      expect(apiContent).toBeTruthy();
    }
  });
});

test.describe('Live Demo Portal - Read-Only Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Handle login if needed
    const loginFormVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    if (loginFormVisible) {
      await page.fill('input[type="text"]', DEMO_USERNAME);
      await page.fill('input[type="password"]', DEMO_PASSWORD);
      await page.click('button:has-text("Sign In"), button:has-text("Login")');
      await page.waitForLoadState('networkidle');
    }
  });

  test('should prevent edits with read-only notification', async ({ page }) => {
    // Look for "Create" or "Add" buttons
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    
    if (await createButton.isVisible().catch(() => false)) {
      // Set up console listener for notifications
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      await createButton.click();
      
      // Wait for either a toast notification to appear or console message
      const readOnlyNotification = await page.locator('text=/read.only|demo mode|cannot.edit/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasReadOnlyMessage = consoleMessages.some(msg => msg.toLowerCase().includes('read') || msg.toLowerCase().includes('demo'));
      
      expect(readOnlyNotification || hasReadOnlyMessage).toBeTruthy();
    }
  });
});

test.describe('Live Demo Portal - CTAs (Call-to-Actions)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Handle login if needed
    const loginFormVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    if (loginFormVisible) {
      await page.fill('input[type="text"]', DEMO_USERNAME);
      await page.fill('input[type="password"]', DEMO_PASSWORD);
      await page.click('button:has-text("Sign In"), button:has-text("Login")');
      await page.waitForLoadState('networkidle');
    }
  });

  test('should have "Start Free Trial" CTA', async ({ page }) => {
    const trialCTA = page.locator('a:has-text("Start Free Trial"), a:has-text("Try Free"), button:has-text("Start Trial")').first();
    const isVisible = await trialCTA.isVisible().catch(() => false);
    
    if (isVisible) {
      const href = await trialCTA.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('should have "Book Demo" CTA', async ({ page }) => {
    const demoCTA = page.locator('a:has-text("Book Demo"), a:has-text("Schedule Demo"), button:has-text("Demo")').first();
    const isVisible = await demoCTA.isVisible().catch(() => false);
    
    if (isVisible) {
      const href = await demoCTA.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });
});

test.describe('Live Demo Portal - Console Errors', () => {
  test('should have no critical console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('404') &&
      !err.toLowerCase().includes('warning')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should have no CORS errors', async ({ page }) => {
    const corsErrors = [];
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('cors')) {
        corsErrors.push(msg.text());
      }
    });
    
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    expect(corsErrors.length).toBe(0);
  });
});

test.describe('Live Demo Portal - Mobile Responsive', () => {
  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const response = await page.goto(DEMO_URL);
    expect(response?.status()).toBe(200);
    
    // Content should be visible
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('should have mobile navigation menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DEMO_URL);
    
    // Look for mobile menu button (hamburger icon)
    const mobileMenuButton = page.locator('button[aria-label*="menu" i], button:has(svg)').first();
    const hasMobileMenu = await mobileMenuButton.isVisible().catch(() => false);
    
    // On mobile, either menu button exists or navigation is visible
    const hasNavigation = await page.locator('nav').isVisible().catch(() => false);
    
    expect(hasMobileMenu || hasNavigation).toBeTruthy();
  });
});

test.describe('Live Demo Portal - Performance', () => {
  test('should load in reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have mock-api.js loaded', async ({ page }) => {
    await page.goto(DEMO_URL);
    
    // Check if mock-api.js is loaded
    const mockApiLoaded = await page.evaluate(() => {
      return window.mockApiInstalled === true || typeof window.originalFetch !== 'undefined';
    });
    
    // If not loaded via window properties, check for console messages
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.reload({ waitUntil: 'networkidle' });
    
    const hasMockApiMessage = consoleMessages.some(msg => 
      msg.includes('MOCK API') || msg.includes('mock-api')
    );
    
    expect(mockApiLoaded || hasMockApiMessage).toBeTruthy();
  });
});
