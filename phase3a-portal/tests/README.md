# Demo Testing Infrastructure

This directory contains automated tests for the live demo portal deployment.

## Overview

The demo testing infrastructure provides comprehensive automated testing for the SecureBase Phase 3a demo portal at:
`http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com`

## Test Types

### 1. Smoke Tests (`test-demo-live.sh`)

Quick validation tests that run in seconds to verify the demo is accessible and functional.

**Run locally:**
```bash
cd phase3a-portal
./test-demo-live.sh
```

**What it tests:**
- ✅ HTTP 200 status
- ✅ HTML structure (DOCTYPE, root element)
- ✅ Mock API accessibility
- ✅ Demo data accessibility
- ✅ Static assets (JS/CSS bundles)
- ✅ Performance (load time < 5s)
- ✅ Availability consistency

### 2. E2E Tests (`tests/e2e/demo-live.spec.js`)

Comprehensive browser-based tests using Playwright that verify the full user experience.

**Run locally:**
```bash
cd phase3a-portal
npm install
npm run test:e2e
```

**Run with UI:**
```bash
npm run test:e2e:ui
```

**What it tests:**

#### Accessibility
- Demo URL returns HTTP 200
- Page has proper title
- Not in quirks mode (standards mode)

#### Authentication
- Mock API loads successfully
- Auto-login or demo/demo credentials work
- Demo credentials accepted

#### Demo Banner
- Demo mode indicator visible
- Read-only mode banner shown

#### Dashboard & Data
- Dashboard loads with sample metrics
- Customer data displays (5 customers expected)
- Charts and visualizations render

#### Navigation
- All navigation links work
- Invoices page loads
- Compliance page loads
- API Keys page loads

#### Read-Only Mode
- Edit buttons show read-only notification
- Create actions are prevented

#### CTAs (Call-to-Actions)
- "Start Free Trial" link present and functional
- "Book Demo" link present and functional

#### Console Errors
- No critical JavaScript errors
- No CORS errors

#### Mobile Responsive
- Works on mobile viewport (375x667)
- Mobile navigation menu present

#### Performance
- Page loads in under 5 seconds
- Mock API loads correctly

### 3. Validation Tests (`test-validation.sh`)

Pre-deployment validation that checks configuration and build artifacts.

**Run locally:**
```bash
cd phase3a-portal
./test-validation.sh
```

**What it validates:**
- Source files exist
- Configuration is correct
- Mock API is properly configured
- Demo data is valid JSON
- Environment variables are set
- Build artifacts are correct
- E2E test suite exists

## GitHub Actions Workflow

The `.github/workflows/test-demo.yml` workflow runs automatically:

1. **After demo deployment** - Validates every deployment
2. **On schedule** - Daily at 8 AM UTC
3. **Manual trigger** - Can be run on-demand

**Workflow jobs:**

1. **smoke-tests** - Quick validation (1-2 minutes)
2. **e2e-tests** - Full E2E tests on Chromium & Firefox (5-10 minutes)
3. **validate-deployment** - Configuration validation (1 minute)
4. **report-results** - Generates summary and uploads artifacts

## Test Results

Test results are available in:
- GitHub Actions workflow runs
- Uploaded artifacts (screenshots, videos, HTML reports)
- Job summaries in GitHub UI

## Configuration

### Environment Variables

```bash
# Default demo URL
DEMO_URL=http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

# Demo credentials
DEMO_USERNAME=demo
DEMO_PASSWORD=demo
```

### Playwright Configuration

See `playwright.config.js` for:
- Browser targets (Chromium, Firefox, WebKit)
- Mobile device emulation
- Timeout settings
- Screenshot/video settings
- Test retry configuration

## Troubleshooting

### Smoke tests fail with HTTP 000

**Cause:** Demo URL is not accessible or incorrect

**Solution:**
1. Verify demo URL is correct
2. Check S3 bucket exists and is public
3. Verify S3 website hosting is enabled
4. Test URL manually in browser

### E2E tests timeout

**Cause:** Page takes too long to load or element not found

**Solution:**
1. Check demo is actually deployed
2. Verify mock API is loading (console messages)
3. Increase timeout in test if legitimate
4. Check network tab for failed requests

### Mock API not loading

**Cause:** mock-api.js not in dist/ or not referenced

**Solution:**
1. Run `./validate-demo-files.sh --check-build`
2. Verify `public/mock-api.js` exists
3. Check `vite.config.js` has `copyPublicDir: true`
4. Verify `index.html` has script tag

### Tests pass locally but fail in CI

**Cause:** Timing differences or environment-specific issues

**Solution:**
1. Add `waitForTimeout()` for dynamic content
2. Use `waitForSelector()` instead of immediate checks
3. Check CI has proper network access
4. Review screenshots from failed CI runs

## Best Practices

1. **Run smoke tests before E2E** - Faster feedback loop
2. **Run validation before build** - Catch config errors early
3. **Use headed mode for debugging** - See what the browser sees
4. **Check artifacts on failure** - Screenshots and videos are uploaded
5. **Update tests when UI changes** - Keep selectors current

## Adding New Tests

### Add a smoke test

Edit `test-demo-live.sh`:
```bash
# Test 9: New Test
echo "Test 9: New Test Description"
# Your test logic here
test_result $? "New test description"
echo ""
```

### Add an E2E test

Edit `tests/e2e/demo-live.spec.js`:
```javascript
test.describe('New Test Category', () => {
  test('should do something', async ({ page }) => {
    await page.goto(DEMO_URL);
    // Your test logic
    expect(something).toBeTruthy();
  });
});
```

### Add a validation check

Edit `test-validation.sh`:
```bash
# Test N: New Validation
echo "Test N: New Validation..."
if [ -f "newfile.js" ]; then
    echo "  ✅ newfile.js exists"
fi
echo ""
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [DEMO_ENVIRONMENT.md](./DEMO_ENVIRONMENT.md) - Demo environment details
- [DEMO_VALIDATION_GUIDE.md](./DEMO_VALIDATION_GUIDE.md) - Validation checklist
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

For issues with the testing infrastructure:
1. Check this README
2. Review test output and artifacts
3. Check demo is actually deployed and accessible
4. Review related documentation files
