/**
 * Phase 3a Portal - Playwright Demo Login Test
 * ============================================================================
 * This script uses Playwright to test the demo login flow in the portal.
 * It verifies:
 * 1. Portal loads correctly
 * 2. Login page is visible
 * 3. Demo credentials (demo/demo) work
 * 4. Dashboard loads after login
 * 5. Auth token is stored
 * 6. User can navigate to other pages
 * 7. Logout works correctly
 * 
 * Usage:
 *   node check_demo_login.js [BASE_URL]
 * 
 * Environment Variables:
 *   BASE_URL - Base URL of the portal (default: http://localhost:5173)
 * 
 * Prerequisites:
 *   npm install -D @playwright/test
 *   npx playwright install
 * ============================================================================
 */

// Check if Playwright is installed
let playwright;
try {
    playwright = require('playwright');
} catch (error) {
    console.error('❌ Playwright is not installed.');
    console.error('Install with: npm install -D playwright && npx playwright install');
    process.exit(1);
}

// Configuration
const BASE_URL = process.env.BASE_URL || process.argv[2] || 'http://localhost:5173';
const TIMEOUT = 30000; // 30 seconds
const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo';

// Test results
const results = {
    passed: [],
    failed: [],
    warnings: []
};

// Helper function to log test results
function logTest(name, passed, message = '') {
    if (passed) {
        console.log(`✅ ${name}`);
        results.passed.push(name);
    } else {
        console.log(`❌ ${name}${message ? ': ' + message : ''}`);
        results.failed.push({ name, message });
    }
}

function logWarning(message) {
    console.log(`⚠️  ${message}`);
    results.warnings.push(message);
}

// Main test function
async function runTests() {
    console.log('=================================================================');
    console.log('Phase 3a Portal - Playwright Demo Login Test');
    console.log('=================================================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Timeout: ${TIMEOUT}ms`);
    console.log('');

    let browser;
    let context;
    let page;

    try {
        // Launch browser
        console.log('🚀 Launching browser...');
        browser = await playwright.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Playwright Test Agent'
        });
        
        page = await context.newPage();
        
        // Enable console logging for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`   [Browser Error] ${msg.text()}`);
            }
        });
        
        console.log('✅ Browser launched\n');

        // ====================================================================
        // Test 1: Portal loads
        // ====================================================================
        console.log('Test 1: Portal loads');
        try {
            await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
            logTest('Portal loads at base URL', true);
        } catch (error) {
            logTest('Portal loads at base URL', false, error.message);
            throw error; // Can't continue if page doesn't load
        }

        // ====================================================================
        // Test 2: Login page is visible
        // ====================================================================
        console.log('\nTest 2: Login page visibility');
        
        // Check for login form elements
        const usernameInput = await page.$('input[name="username"], input[type="text"], input[placeholder*="username" i]');
        logTest('Username input field exists', !!usernameInput);
        
        const passwordInput = await page.$('input[name="password"], input[type="password"]');
        logTest('Password input field exists', !!passwordInput);
        
        const submitButton = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
        logTest('Submit button exists', !!submitButton);

        // Check for demo banner (optional)
        const demoBanner = await page.$('text=/demo mode/i, text=/demo environment/i');
        if (demoBanner) {
            logTest('Demo mode banner is visible', true);
        } else {
            logWarning('Demo mode banner not visible (this is optional)');
        }

        // ====================================================================
        // Test 3: Demo login succeeds
        // ====================================================================
        console.log('\nTest 3: Demo login flow');
        
        if (!usernameInput || !passwordInput || !submitButton) {
            logTest('Demo login', false, 'Login form elements not found');
        } else {
            try {
                // Fill in credentials
                await usernameInput.fill(DEMO_USERNAME);
                logTest('Username field filled', true);
                
                await passwordInput.fill(DEMO_PASSWORD);
                logTest('Password field filled', true);
                
                // Submit form
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle', timeout: TIMEOUT }).catch(() => {}),
                    submitButton.click()
                ]);
                
                // Wait a bit for any redirects or state updates
                await page.waitForTimeout(2000);
                
                logTest('Login form submitted', true);
                
            } catch (error) {
                logTest('Demo login', false, error.message);
            }
        }

        // ====================================================================
        // Test 4: Dashboard loads after login
        // ====================================================================
        console.log('\nTest 4: Dashboard after login');
        
        // Check URL changed (should redirect from login page)
        const currentUrl = page.url();
        const isNotLoginPage = !currentUrl.includes('/login') && currentUrl !== BASE_URL + '/';
        logTest('Redirected from login page', isNotLoginPage);
        
        // Check for dashboard elements
        const dashboardElements = await page.$$('text=/dashboard/i, h1, h2, h3');
        logTest('Dashboard content loaded', dashboardElements.length > 0);
        
        // Check for common dashboard components
        const hasMetrics = await page.$('text=/metrics/i, text=/total/i, text=/spend/i, text=/cost/i');
        if (hasMetrics) {
            logTest('Dashboard metrics visible', true);
        } else {
            logWarning('Dashboard metrics not found (may be in a different format)');
        }

        // ====================================================================
        // Test 5: Auth token is stored
        // ====================================================================
        console.log('\nTest 5: Authentication state');
        
        // Check localStorage or sessionStorage for token
        const localStorageToken = await page.evaluate(() => {
            return localStorage.getItem('token') || 
                   localStorage.getItem('authToken') || 
                   localStorage.getItem('auth_token') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');
        });
        
        logTest('Auth token is stored', !!localStorageToken);
        
        if (localStorageToken && localStorageToken.includes('demo')) {
            logTest('Auth token is demo token', true);
        }

        // ====================================================================
        // Test 6: Navigation to other pages
        // ====================================================================
        console.log('\nTest 6: Page navigation');
        
        // Try to find and click navigation links
        const navLinks = await page.$$('a, button');
        
        // Look for Invoices link
        const invoicesLink = await page.$('a:has-text("Invoices"), a[href*="invoice"]');
        if (invoicesLink) {
            try {
                await invoicesLink.click();
                await page.waitForTimeout(1000);
                const invoicesUrl = page.url();
                logTest('Navigate to Invoices page', invoicesUrl.includes('invoice'));
            } catch (error) {
                logTest('Navigate to Invoices page', false, error.message);
            }
        } else {
            logWarning('Invoices navigation link not found');
        }
        
        // Look for API Keys link
        const apiKeysLink = await page.$('a:has-text("API Keys"), a[href*="api"]');
        if (apiKeysLink) {
            try {
                await apiKeysLink.click();
                await page.waitForTimeout(1000);
                const apiKeysUrl = page.url();
                logTest('Navigate to API Keys page', apiKeysUrl.includes('api'));
            } catch (error) {
                logTest('Navigate to API Keys page', false, error.message);
            }
        } else {
            logWarning('API Keys navigation link not found');
        }

        // ====================================================================
        // Test 7: Logout works
        // ====================================================================
        console.log('\nTest 7: Logout functionality');
        
        // Look for logout button (in user menu, dropdown, etc.)
        const logoutButton = await page.$('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');
        
        if (logoutButton) {
            try {
                await logoutButton.click();
                await page.waitForTimeout(1000);
                
                const afterLogoutUrl = page.url();
                const redirectedToLogin = afterLogoutUrl.includes('login') || afterLogoutUrl === BASE_URL || afterLogoutUrl === BASE_URL + '/';
                logTest('Logout redirects to login page', redirectedToLogin);
                
                // Check token is cleared
                const tokenAfterLogout = await page.evaluate(() => {
                    return localStorage.getItem('token') || sessionStorage.getItem('token');
                });
                logTest('Auth token cleared after logout', !tokenAfterLogout);
                
            } catch (error) {
                logTest('Logout', false, error.message);
            }
        } else {
            logWarning('Logout button not found (may be in a user menu)');
        }

        // ====================================================================
        // Test 8: Invalid credentials are rejected
        // ====================================================================
        console.log('\nTest 8: Invalid credentials');
        
        // Make sure we're on login page
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await page.waitForTimeout(1000);
        
        const invalidUsernameInput = await page.$('input[name="username"], input[type="text"]');
        const invalidPasswordInput = await page.$('input[name="password"], input[type="password"]');
        const invalidSubmitButton = await page.$('button[type="submit"]');
        
        if (invalidUsernameInput && invalidPasswordInput && invalidSubmitButton) {
            try {
                await invalidUsernameInput.fill('wrong');
                await invalidPasswordInput.fill('wrong');
                await invalidSubmitButton.click();
                
                await page.waitForTimeout(2000);
                
                // Check for error message
                const errorMessage = await page.$('text=/invalid/i, text=/error/i, text=/incorrect/i, [role="alert"]');
                logTest('Invalid credentials show error message', !!errorMessage);
                
                // Ensure we're still on login page
                const stillOnLogin = page.url().includes('login') || page.url() === BASE_URL || page.url() === BASE_URL + '/';
                logTest('Invalid credentials do not authenticate', stillOnLogin);
                
            } catch (error) {
                logWarning('Could not test invalid credentials: ' + error.message);
            }
        }

    } catch (error) {
        console.error('\n❌ Test suite error:', error.message);
        results.failed.push({ name: 'Test Suite', message: error.message });
    } finally {
        // Close browser
        if (browser) {
            await browser.close();
            console.log('\n✅ Browser closed');
        }
    }

    // ====================================================================
    // Print Summary
    // ====================================================================
    console.log('\n=================================================================');
    console.log('Test Summary');
    console.log('=================================================================');
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    
    if (results.failed.length > 0) {
        console.log('\nFailed Tests:');
        results.failed.forEach(failure => {
            console.log(`  - ${failure.name}${failure.message ? ': ' + failure.message : ''}`);
        });
    }
    
    if (results.warnings.length > 0) {
        console.log('\nWarnings:');
        results.warnings.forEach(warning => {
            console.log(`  - ${warning}`);
        });
    }
    
    console.log('\n=================================================================\n');
    
    // Exit with appropriate code
    const exitCode = results.failed.length > 0 ? 1 : 0;
    process.exit(exitCode);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
