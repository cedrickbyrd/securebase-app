# Phase 3a Portal Frontend Test Plan

## Overview

This document provides comprehensive testing instructions for the SecureBase Phase 3a Customer Portal frontend. The test plan covers local development testing, deployed demo testing, and verification of core user flows.

**⚠️ IMPORTANT:** All tests must use **mock/demo mode only**. Do not attempt to connect to real AWS backend or production accounts.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Local Testing](#local-testing)
4. [Deployed Testing](#deployed-testing)
5. [Test Scenarios](#test-scenarios)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js**: v18.x or higher (check with `node --version`)
- **npm**: v9.x or higher (check with `npm --version`)
- **Git**: For cloning and version control

### Optional Software (for advanced testing)
- **Playwright**: For automated browser testing (`npm install -D @playwright/test`)
- **curl**: For API endpoint smoke checks (usually pre-installed)
- **serve**: For testing production builds locally (`npm install -g serve`)

### Environment Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/cedrickbyrd/securebase-app.git
   cd securebase-app
   ```

2. Navigate to the portal directory:
   ```bash
   cd phase3a-portal
   ```

3. Install dependencies:
   ```bash
   npm ci
   ```

---

## Quick Start

The fastest way to run all local tests:

```bash
# From repository root
./tests/frontend/run_local_tests.sh
```

Or run tests step-by-step:

```bash
# 1. Run automated checks
cd tests/frontend
./run_local_tests.sh

# 2. Run Playwright demo login test (if Playwright installed)
node check_demo_login.js
```

---

## Local Testing

### Step 1: Configure Demo Mode

Set the environment to use mock API (no real backend):

```bash
cd phase3a-portal
export VITE_USE_MOCK_API=true
export VITE_DEMO_MODE=true
```

Or copy the demo environment file:

```bash
cp .env.demo .env
```

### Step 2: Start Development Server

```bash
npm run dev
```

The portal should start at `http://localhost:5173`

### Step 3: Manual Testing Checklist

#### ✅ Portal Loads
- [ ] Navigate to `http://localhost:5173`
- [ ] Page loads without errors (check browser console)
- [ ] Login page is visible
- [ ] Demo mode banner is displayed (if `VITE_SHOW_DEMO_BANNER=true`)

#### ✅ Demo Login
- [ ] Enter username: `demo`
- [ ] Enter password: `demo`
- [ ] Click "Sign In" or press Enter
- [ ] Login succeeds and redirects to dashboard
- [ ] Token is stored in sessionStorage/localStorage
- [ ] User menu shows "Demo User" or "demo@securebase.io"

#### ✅ Invalid Credentials
- [ ] Try username: `wrong` / password: `wrong`
- [ ] Error message is displayed
- [ ] User remains on login page
- [ ] After 5 failed attempts, rate limiting kicks in (1-minute lockout)

#### ✅ Dashboard Page
- [ ] Dashboard loads at `/dashboard` or `/`
- [ ] Metrics cards are visible (e.g., "Total Spend", "Active Resources")
- [ ] Cost trend chart renders
- [ ] Compliance score is displayed
- [ ] Quick actions are available
- [ ] No console errors

#### ✅ Invoices Page
- [ ] Navigate to Invoices (from sidebar or menu)
- [ ] Invoice list is displayed with mock data
- [ ] Invoices show correct data (date, amount, status)
- [ ] Can filter or search invoices
- [ ] "Download PDF" button is present (may show coming soon in mock mode)
- [ ] Pagination works (if applicable)

#### ✅ API Keys Page
- [ ] Navigate to API Keys
- [ ] Existing keys are displayed (mock data)
- [ ] "Create API Key" button is visible
- [ ] Can view key details (scopes, created date)
- [ ] "Revoke" or "Delete" action is available
- [ ] Creating a key shows mock success response

#### ✅ Compliance Page
- [ ] Navigate to Compliance
- [ ] Compliance framework is displayed (e.g., HIPAA, SOC2)
- [ ] Security findings or config rules are shown
- [ ] Compliance score/status is visible
- [ ] No errors in rendering compliance data

#### ✅ Support/Tickets Page (if available)
- [ ] Navigate to Support or Tickets
- [ ] Ticket list is displayed
- [ ] Can view ticket details
- [ ] "Create Ticket" option is available

#### ✅ Logout
- [ ] Click logout from user menu
- [ ] Redirects to login page
- [ ] Token is cleared from storage
- [ ] Cannot access protected routes without logging in again

#### ✅ Routing & SPA Behavior
- [ ] Browser back/forward buttons work correctly
- [ ] Direct URL navigation works (e.g., `http://localhost:5173/invoices`)
- [ ] 404 or fallback page for unknown routes
- [ ] SPA rewrites work correctly

### Step 4: Production Build Testing

Test the production build locally:

```bash
# Build for demo/production
npm run build:demo

# Serve the build
npx serve -s dist -p 5173

# Or use global serve if installed
# serve -s dist -p 5173
```

Then repeat the manual testing checklist above on `http://localhost:5173`.

---

## Deployed Testing

### Marketing Site (Netlify/GitHub Pages)
The root marketing site is deployed separately from the customer portal.

**Demo URL:** `https://demo.securebase.tximhotep.com` (or similar)

#### Test Checklist
- [ ] Marketing page loads at root URL
- [ ] Hero section with product description is visible
- [ ] CTA buttons are present (e.g., "Try Demo", "Get Started")
- [ ] Click "Portal" or "Customer Portal" link
- [ ] Verify it navigates to the portal (separate deployment or subdomain)

### Customer Portal (Netlify)
The Phase 3a portal is deployed as a separate app.

**Demo URL:** `https://demo.securebase.tximhotep.com` or `https://portal.securebase.tximhotep.com` (check deployment)

#### Test Checklist
- [ ] Portal loads at deployed URL
- [ ] Demo mode banner is visible (indicates mock API is active)
- [ ] Login page is displayed
- [ ] Demo login works: username `demo`, password `demo`
- [ ] Dashboard loads with mock data
- [ ] All navigation links work (Invoices, API Keys, Compliance, etc.)
- [ ] No real backend API calls are made (check Network tab)
- [ ] Mock responses are returned for all API requests
- [ ] Logout works correctly

#### Edge Cases & Security
- [ ] Invalid credentials are rejected
- [ ] No sensitive data in browser console or network requests
- [ ] HTTPS is enabled on deployed site
- [ ] CORS errors do not appear
- [ ] Service worker (if applicable) updates correctly

---

## Test Scenarios

### Scenario 1: New User Demo Flow
1. User visits deployed demo portal
2. Sees demo banner indicating "This is a demo environment"
3. Logs in with demo/demo
4. Explores dashboard with sample data
5. Views invoices, API keys, compliance status
6. Logs out successfully

**Expected:** All features work with mock data. No errors. Clear indication this is demo mode.

### Scenario 2: Invalid Login Attempts
1. User tries to log in with incorrect credentials
2. Error message: "Invalid credentials"
3. After 5 failed attempts, rate limiting message appears
4. User must wait 1 minute before trying again
5. After waiting, can retry login

**Expected:** Rate limiting protects against brute force. User sees helpful error messages.

### Scenario 3: Direct URL Navigation
1. User logs in to demo portal
2. Bookmarks `/invoices` URL
3. Logs out
4. Visits bookmarked URL directly
5. Redirected to login page (session expired)
6. After login, redirected to originally requested URL (`/invoices`)

**Expected:** Authentication guard works. User is redirected appropriately.

### Scenario 4: SPA Navigation
1. User navigates from Dashboard → Invoices → API Keys
2. Uses browser back button
3. Returns to Invoices
4. Uses forward button
5. Returns to API Keys
6. Direct refresh on `/api-keys` URL

**Expected:** Browser history works correctly. No full page reloads. SPA behavior preserved.

### Scenario 5: Mock API Responses
1. Open browser DevTools → Network tab
2. Log in to demo portal
3. Navigate to Invoices
4. Observe network requests
5. Verify responses come from mock data (no real API calls)

**Expected:** All API responses are mocked. No real backend requests. Mock data matches expected schema.

---

## Verification Checklist

Use this checklist for comprehensive verification before release:

### ✅ Environment Configuration
- [ ] `.env.demo` file exists and has `VITE_USE_MOCK_API=true`
- [ ] Demo credentials are documented (demo/demo)
- [ ] Demo mode banner configuration is correct
- [ ] No production secrets or keys in demo config

### ✅ Authentication
- [ ] Demo login succeeds with demo/demo
- [ ] Invalid credentials are rejected
- [ ] Rate limiting works after 5 failed attempts
- [ ] Logout clears session correctly
- [ ] Auth token is stored securely (localStorage/sessionStorage)

### ✅ Core Pages
- [ ] Dashboard loads and displays metrics
- [ ] Invoices page shows mock invoices
- [ ] API Keys page shows mock keys
- [ ] Compliance page shows mock compliance data
- [ ] Support/Tickets page works (if implemented)

### ✅ UI/UX
- [ ] All navigation links work
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Icons and images load correctly
- [ ] Charts render without errors
- [ ] Forms validate user input
- [ ] Loading states are shown appropriately
- [ ] Error messages are user-friendly

### ✅ Performance
- [ ] Initial page load < 2 seconds
- [ ] Navigation between pages is instant (SPA)
- [ ] No console errors or warnings
- [ ] No memory leaks (check DevTools)
- [ ] Production build is optimized (code splitting, minification)

### ✅ Security
- [ ] HTTPS enabled on deployed site
- [ ] No sensitive data in console logs
- [ ] Mock API does not expose real data
- [ ] CORS configured correctly
- [ ] CSP headers present (Content Security Policy)
- [ ] No mixed content warnings

### ✅ Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader friendly (ARIA labels)
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible

### ✅ Browser Compatibility
- [ ] Works in Chrome/Edge (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

---

## Troubleshooting

### Issue: Portal doesn't load / blank page

**Solution:**
- Check browser console for errors
- Verify `npm install` was run successfully
- Clear browser cache and reload
- Check that `.env` file is configured correctly
- Verify Vite dev server is running on correct port

### Issue: Login fails with valid credentials (demo/demo)

**Solution:**
- Verify `VITE_USE_MOCK_API=true` in `.env`
- Check browser console for authentication errors
- Ensure mock auth service is imported correctly
- Clear localStorage/sessionStorage and retry

### Issue: "Network Error" or "Failed to fetch"

**Solution:**
- Ensure mock API is enabled: `VITE_USE_MOCK_API=true`
- If trying to reach real API, disable it for testing
- Check CORS configuration
- Verify API base URL in `.env`

### Issue: Rate limiting locks out immediately

**Solution:**
- Clear sessionStorage: `sessionStorage.clear()`
- Refresh the page
- Wait 1 minute for lockout to expire

### Issue: Production build fails

**Solution:**
- Check for missing environment variables
- Run `npm run build` and review build errors
- Ensure all dependencies are installed
- Check for TypeScript or linting errors

### Issue: Deployed site shows 404 errors

**Solution:**
- Verify SPA rewrites are configured in `netlify.toml`
- Check that `index.html` is in the correct location (`dist/`)
- Ensure build output directory is set correctly in deployment config

---

## Automated Testing

### Run Automated Tests

```bash
# From repository root
./tests/frontend/run_local_tests.sh
```

This script will:
1. Check prerequisites (Node.js, npm)
2. Install dependencies (`npm ci`)
3. Set environment to demo mode
4. Build the portal
5. Serve the build
6. Run smoke tests (curl checks)
7. Run Playwright tests (if installed)
8. Generate test report

### Run Playwright Demo Login Test

If Playwright is installed:

```bash
cd tests/frontend
node check_demo_login.js
```

Or install Playwright and run:

```bash
npm install -D @playwright/test
npx playwright install
node tests/frontend/check_demo_login.js
```

---

## CI/CD Integration

To integrate these tests in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run Frontend Tests
  run: |
    cd phase3a-portal
    npm ci
    export VITE_USE_MOCK_API=true
    npm run build:demo
    cd ../tests/frontend
    ./run_local_tests.sh
```

---

## Additional Resources

- [Phase 3a Portal README](../../phase3a-portal/README.md)
- [Demo Environment Guide](../../phase3a-portal/DEMO_ENVIRONMENT.md)
- [E2E Testing Guide](../../E2E_TESTING_GUIDE.md)
- [Frontend Test Results](../../FRONTEND_TEST_RESULTS.md)

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section above
- Review browser console for errors
- Check [GitHub Issues](https://github.com/cedrickbyrd/securebase-app/issues)
- Contact: support@securebase.io

---

**Last Updated:** 2026-02-04  
**Test Plan Version:** 1.0.0
