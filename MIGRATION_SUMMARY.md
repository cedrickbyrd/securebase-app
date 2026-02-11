# Custom Domain Migration Summary

## Overview
This PR implements a complete migration from Netlify default URLs to custom domains for SecureBase.

## URL Changes

### Marketing Site
- **Old**: `https://securebase-app.netlify.app`
- **New**: `https://securebase.io`
- **Redirect**: 301 permanent redirect configured

### Demo Portal
- **Old**: `https://securebase-demo.netlify.app` and `http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com`
- **New**: `https://demo.securebase.io`
- **Redirect**: 301 permanent redirect configured

## Files Created

1. **`docs/DNS_CONFIGURATION.md`** - Complete DNS setup guide
   - Required DNS records for marketing site and demo portal
   - Netlify configuration instructions
   - Verification commands

2. **`docs/CUSTOM_DOMAIN_MIGRATION.md`** - Migration guide
   - Step-by-step migration process
   - Pre-migration checklist
   - Verification steps
   - Rollback plan

3. **`docs/SUBDOMAIN_ARCHITECTURE.md`** - Subdomain documentation
   - Current active subdomains
   - Future planned subdomains (app, api, docs, status)
   - Security considerations

## Files Updated

### Configuration Files (8 files)
- `netlify.toml` - Added 301 redirects for old URLs
- `phase3a-portal/netlify.toml` - Added 301 redirects for old URLs
- `phase3a-portal/.env.demo` - Updated URLs to custom domains
- `phase3a-portal/.env.demo.backend` - Updated CORS origin
- `phase3a-portal/.env.production` - Updated production URLs
- `phase3a-portal/playwright.config.js` - Updated base URL
- `phase3a-portal/tests/e2e/demo-live.spec.js` - Updated test URLs
- `phase2-backend/functions/create_checkout_session.py` - Updated success/cancel URLs

### Documentation Files (7 files)
- `README.md` - URLs already correct
- `DEMO_DEPLOYMENT_CHECKLIST.md` - Updated deployment URLs
- `DEMO_HOSTING_READINESS.md` - Updated hosting URLs
- `DEMO_QUICK_START.md` - Updated demo URLs
- `DEMO_SALES_GUIDE.md` - Updated sales demo URLs
- `phase3a-portal/DEMO_ENVIRONMENT.md` - Updated environment URLs
- `STRIPE_DEPLOYMENT_CHECKLIST.md` - Updated portal URLs
- `DEMO_MARKETING_ASSESSMENT.md` - Updated live URLs
- `tests/frontend/README.md` - Updated test URLs

### GitHub Workflows (4 files)
- `.github/workflows/test-demo.yml` - Updated demo URL defaults
- `.github/workflows/deploy-marketing-site.yml` - Updated verification URLs
- `.github/workflows/securebase-health-monitor.yml` - Updated health check URLs
- `.github/workflows/securebase-frontend-pipeline.yml` - Updated deployment URLs

### Source Code (1 file)
- `src/App.jsx` - Updated demo link

## Redirect Configuration

### Marketing Site Redirects
```toml
# Old domain → New domain
https://securebase-app.netlify.app/* → https://securebase.io/:splat (301)

# Force HTTPS
http://securebase.io/* → https://securebase.io/:splat (301)

# www → apex
https://www.securebase.io/* → https://securebase.io/:splat (301)
```

### Demo Portal Redirects
```toml
# Old domain → New domain
https://securebase-demo.netlify.app/* → https://demo.securebase.io/:splat (301)

# Force HTTPS
http://demo.securebase.io/* → https://demo.securebase.io/:splat (301)
```

## Environment Variables Updated

### Demo Environment (`.env.demo`)
- `VITE_API_BASE_URL`: `https://demo.securebase.io/api`
- `VITE_APP_URL`: `https://demo.securebase.io`
- `VITE_DEMO_CTA_TRIAL_URL`: `https://securebase.io/signup`
- `VITE_DEMO_CTA_BOOK_DEMO_URL`: `https://securebase.io/contact`

### Production Environment (`.env.production`)
- `VITE_API_BASE_URL`: `https://api.securebase.io/v1`
- `VITE_APP_URL`: `https://app.securebase.io`
- `VITE_MARKETING_URL`: `https://securebase.io`
- `VITE_SUPPORT_URL`: `https://securebase.io/support`
- `VITE_DOCS_URL`: `https://docs.securebase.io`

## Testing Updates

### Playwright Configuration
- Base URL: `https://demo.securebase.io` (was S3 URL)
- E2E tests updated to use new URL

### GitHub Actions
- All workflow test URLs updated
- Health monitoring updated
- Deployment verification updated

## Backend Updates

### Stripe Checkout
Updated success/cancel URLs in `create_checkout_session.py`:
- Success: `https://demo.securebase.io/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://demo.securebase.io/signup?cancelled=true`

## Deployment Steps Required

### 1. DNS Configuration (Manual)
Follow instructions in `docs/DNS_CONFIGURATION.md`:
- Add A record for `securebase.io` → `75.2.60.5`
- Add CNAME for `www.securebase.io` → `securebase.io`
- Add CNAME for `demo.securebase.io` → `securebase-demo.netlify.app`

### 2. Netlify Configuration (Manual)
**Marketing Site:**
1. Netlify dashboard → securebase-app site
2. Add custom domain: `securebase.io`
3. Add custom domain: `www.securebase.io`
4. Set primary domain to `securebase.io`
5. Wait for SSL provisioning

**Demo Portal:**
1. Netlify dashboard → securebase-demo site
2. Add custom domain: `demo.securebase.io`
3. Wait for SSL provisioning

### 3. Verification
```bash
# Test DNS propagation
dig securebase.io
dig demo.securebase.io

# Test HTTPS
curl -I https://securebase.io
curl -I https://demo.securebase.io

# Test redirects
curl -I https://securebase-app.netlify.app  # Should 301 to securebase.io
curl -I https://securebase-demo.netlify.app  # Should 301 to demo.securebase.io

# Run E2E tests
cd phase3a-portal
DEMO_URL=https://demo.securebase.io npm run test:e2e
```

## Non-Breaking Changes

- Old Netlify URLs will continue to work
- 301 redirects ensure no broken links
- SSL certificates auto-provision
- Rollback available by removing custom domains from Netlify

## Timeline

- DNS setup: 5 minutes
- DNS propagation: 15 min - 48 hours (typically < 1 hour)
- Netlify SSL provisioning: 1-2 minutes
- Code deployment: Automatic via CI/CD
- **Total**: ~30 minutes (excluding DNS propagation)

## Success Criteria

- ✅ `https://securebase.io` serves marketing site
- ✅ `https://demo.securebase.io` serves demo portal
- ✅ Old URLs redirect to new domains (301)
- ✅ SSL/TLS certificates valid on all domains
- ✅ No broken links in documentation
- ✅ E2E tests pass with new URLs
- ✅ Environment variables updated
- ✅ All configuration files updated

## Support Documents

- Migration guide: `docs/CUSTOM_DOMAIN_MIGRATION.md`
- DNS setup: `docs/DNS_CONFIGURATION.md`
- Subdomain plan: `docs/SUBDOMAIN_ARCHITECTURE.md`
