# Custom Domain Migration Guide

## Overview
This guide documents the migration from Netlify default domains to custom domains.

## Migration Steps

### 1. Pre-Migration Checklist
- [ ] Domain `securebase.io` purchased and accessible
- [ ] DNS provider identified (Cloudflare, Route53, etc.)
- [ ] Netlify sites identified:
  - Marketing: securebase-app
  - Demo: securebase-demo

### 2. DNS Configuration (DO THIS FIRST)
Follow `docs/DNS_CONFIGURATION.md` to add DNS records.

Wait for DNS propagation (15 min - 48 hours, typically < 1 hour).

Verify:
```bash
dig securebase.io
dig demo.securebase.io
```

### 3. Netlify Domain Setup

#### Marketing Site
1. Netlify dashboard → securebase-app site
2. Domain settings → Add custom domain: `securebase.io`
3. Add domain: `www.securebase.io`
4. Set primary: `securebase.io`
5. Wait for SSL provisioning (~1 minute)

#### Demo Portal
1. Netlify dashboard → securebase-demo site
2. Domain settings → Add custom domain: `demo.securebase.io`
3. Wait for SSL provisioning (~1 minute)

### 4. Deploy Updated Code
```bash
# Marketing site - push to main branch
git push origin main

# Demo portal - Netlify auto-deploys from main
```

### 5. Verification
```bash
# Test marketing site
curl -I https://securebase.io
# Should return 200 OK

# Test demo portal
curl -I https://demo.securebase.io
# Should return 200 OK

# Test redirects
curl -I https://securebase-app.netlify.app
# Should return 301 redirect to securebase.io

# Run E2E tests
cd phase3a-portal
npm run test:e2e
```

### 6. Post-Migration
- [ ] Update Google Search Console (if used)
- [ ] Update any external links/bookmarks
- [ ] Notify team of new URLs
- [ ] Update email signatures
- [ ] Update social media links

## Rollback Plan
If issues occur:
1. Netlify keeps default domains active
2. Remove custom domains from Netlify settings
3. Revert DNS changes
4. Old URLs will work immediately

## Timeline
- DNS setup: 5 minutes
- DNS propagation: 15 min - 1 hour (typically)
- Netlify SSL provisioning: 1-2 minutes
- Code deployment: 5 minutes
- **Total**: ~30 minutes (excluding DNS propagation)
