# Demo Deployment Validation Guide

## Overview

This guide explains the validation process for the SecureBase Phase 3a demo deployment to ensure all critical files are properly configured and deployed.

## Problem Statement

The live demo deployment at `http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com` was failing due to:

1. **Missing files after build** - `dist/index.html` and `dist/mock-api.js` were not created
2. **Quirks Mode** - Page loaded without proper DOCTYPE declaration
3. **Mock API not loading** - CORS errors persisted, mock fetch interceptor never loaded
4. **Vite configuration** - Public folder was not being copied to dist during build

## Solution

### Files Created/Modified

#### 1. **public/mock-api.js** (New)
Mock API fetch interceptor that:
- Detects demo/S3 website environments
- Intercepts all fetch calls except static assets
- Returns mock data to prevent CORS errors
- Logs all actions to console for debugging

#### 2. **validate-demo-files.sh** (New)
Pre-deployment validation script that checks:
- Source files exist (index.html, public/mock-api.js, .env.demo, vite.config.js)
- Configuration is correct (publicDir in vite.config.js)
- index.html has proper DOCTYPE
- index.html references mock-api.js
- Build output is correct (with `--check-build` flag)

#### 3. **vite.config.js** (Modified)
Added configuration to ensure public folder is copied:
```javascript
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: 'public',        // Explicitly set
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,      // Force copy public folder
    sourcemap: true,
    // ... rest of config
  },
}));
```

#### 4. **index.html** (Modified)
Added mock-api.js script reference:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- ... other meta tags ... -->
    <script src="/mock-api.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

#### 5. **.env.demo** (Modified)
Added mock API flag:
```bash
VITE_USE_MOCK_API=true
```

#### 6. **deploy-demo.sh** (Modified)
Enhanced deployment script with:
- Pre-deployment validation (runs validate-demo-files.sh)
- Post-build validation (checks dist/ output)
- Fallback logic (manually copies mock-api.js if Vite fails)
- Comprehensive error messages

## Validation Process

### Pre-Build Validation

Run the validation script to check source files:

```bash
cd phase3a-portal
./validate-demo-files.sh
```

**Expected output:**
```
🔍 Validating demo files...
✅ index.html exists
✅ public/mock-api.js exists
✅ .env.demo exists
✅ vite.config.js exists
✅ vite.config.js has publicDir configured
✅ index.html has DOCTYPE
✅ index.html references mock-api.js

✅ All validation checks passed!
```

### Build Validation

Run validation with build check:

```bash
./validate-demo-files.sh --check-build
```

**Additional checks:**
- ✅ dist/index.html created
- ✅ dist/mock-api.js created
- ✅ dist/index.html has DOCTYPE
- ✅ dist/index.html references mock-api.js

### Deployment Validation

The `deploy-demo.sh` script automatically:
1. Runs pre-deployment validation
2. Builds the project
3. Validates build output
4. Manually copies mock-api.js if needed (fallback)
5. Deploys to S3
6. Reports deployment URL

```bash
./deploy-demo.sh
```

### Browser Validation

After deployment, open the demo URL in an incognito browser window:

**Expected console output:**
```
🎭 MOCK API LOADED!
✅ Installing mock fetch
✅ MOCK INSTALLED!
```

**Verify:**
- ✅ No "Quirks Mode" warning in console
- ✅ No CORS errors
- ✅ Dashboard loads with data
- ✅ Page is in Standards Mode

## Troubleshooting

### Issue: dist/mock-api.js not created

**Cause:** Vite not copying public folder

**Solution:** 
1. Verify `publicDir: 'public'` in vite.config.js
2. Verify `copyPublicDir: true` in build config
3. Run `npm run build -- --mode demo` manually
4. Check if public/ directory exists

**Fallback:** The deploy script will automatically copy the file if missing.

### Issue: Mock API not loading in browser

**Cause:** Script reference missing or incorrect

**Solution:**
1. Verify `<script src="/mock-api.js"></script>` in index.html
2. Check browser network tab - mock-api.js should load (HTTP 200)
3. Check console for "🎭 MOCK API LOADED!" message
4. Verify hostname includes "demo" or "s3-website"

### Issue: CORS errors persist

**Cause:** Mock API not intercepting fetches

**Solution:**
1. Check console for "✅ MOCK INSTALLED!" message
2. Verify hostname detection in mock-api.js
3. Check fetch intercepts in console: "🎭 Intercepted: [url]"
4. Ensure VITE_USE_MOCK_API=true in .env.demo

### Issue: Quirks Mode warning

**Cause:** Missing or malformed DOCTYPE

**Solution:**
1. Verify `<!DOCTYPE html>` is first line of index.html
2. Run validation: `./validate-demo-files.sh`
3. Check dist/index.html after build
4. Ensure Vite transforms the HTML correctly

## Testing Checklist

Before deploying to production:

- [ ] Run `./validate-demo-files.sh` - all checks pass
- [ ] Run `./validate-demo-files.sh --check-build` - all checks pass
- [ ] Build creates dist/index.html
- [ ] Build creates dist/mock-api.js
- [ ] dist/index.html has proper DOCTYPE
- [ ] dist/index.html references mock-api.js
- [ ] Deploy to S3 succeeds
- [ ] Browser shows "🎭 MOCK API LOADED!"
- [ ] Browser shows "✅ MOCK INSTALLED!"
- [ ] No CORS errors in console
- [ ] No Quirks Mode warning
- [ ] Dashboard loads and displays data

## CI/CD Integration

The validation script can be integrated into CI/CD pipelines:

```bash
# In your CI/CD pipeline
cd phase3a-portal
chmod +x validate-demo-files.sh

# Pre-build validation
./validate-demo-files.sh || exit 1

# Build
npm run build -- --mode demo

# Post-build validation
./validate-demo-files.sh --check-build || exit 1

# Deploy
./deploy-demo.sh --ci
```

## File Structure

```
phase3a-portal/
├── public/
│   └── mock-api.js              # Mock fetch interceptor
├── index.html                    # Root HTML (references mock-api.js)
├── vite.config.js                # Vite config (publicDir, copyPublicDir)
├── .env.demo                     # Demo environment variables
├── validate-demo-files.sh        # Validation script
├── deploy-demo.sh                # Deployment script
└── DEMO_VALIDATION_GUIDE.md      # This file
```

## Additional Resources

- [Vite Public Directory](https://vitejs.dev/guide/assets.html#the-public-directory)
- [Vite Configuration Reference](https://vitejs.dev/config/)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CORS and Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

## Success Metrics

✅ **Zero deployment failures**  
✅ **Zero CORS errors**  
✅ **Zero Quirks Mode warnings**  
✅ **100% file validation pass rate**  
✅ **Mock API loads on every deployment**

---

**Last Updated:** February 4, 2026  
**Maintainer:** SecureBase Team
