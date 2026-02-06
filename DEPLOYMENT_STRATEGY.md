# Deployment Strategy

**Last Updated:** February 5, 2026  
**Status:** ✅ Production Ready  

---

## 📋 Overview

SecureBase uses a multi-site deployment strategy with Netlify as the primary hosting platform. This document outlines the domain structure, deployment configurations, and operational procedures for all SecureBase web properties.

---

## 🌐 Domain Structure

SecureBase operates two primary web properties with distinct purposes:

### 1. Marketing Site - `securebase.io`

**Purpose:** Public-facing marketing and landing pages  
**Platform:** Netlify  
**Repository:** Root directory (`/`)  

**Features:**
- Product information and features
- Pricing pages
- Documentation links
- Contact and signup CTAs
- Blog (future)

**Source Code:**
```
Repository Root
├── index.html          # Main landing page
├── src/               # React application source
│   ├── App.jsx        # Main app component
│   └── ...
├── public/            # Static assets
├── netlify.toml       # Netlify configuration
└── package.json       # Build dependencies
```

**Build Configuration:**
- Build command: `npm run build`
- Publish directory: `dist/`
- Node version: 18
- Environment: Production

---

### 2. Portal Demo - `demo.securebase.io`

**Purpose:** Interactive demo of the customer portal with mock data  
**Platform:** Netlify  
**Repository:** `phase3a-portal/` subdirectory  

**Features:**
- Full customer dashboard with realistic data
- 5 mock customers across all tiers
- Read-only mode (no modifications allowed)
- Mock API with 37+ endpoints
- Auto-login (no authentication required)
- Demo banner with CTAs

**Source Code:**
```
phase3a-portal/
├── index.html              # Portal entry point
├── src/                    # React application
│   ├── App.jsx            # Portal app
│   ├── components/        # UI components
│   │   ├── DemoBanner.jsx # Demo mode banner
│   │   └── ...
│   └── services/          # API services
├── demo-data.json         # Mock customer data
├── netlify.toml           # Netlify configuration
└── package.json           # Dependencies
```

**Build Configuration:**
- Base directory: `phase3a-portal`
- Build command: `npm run build`
- Publish directory: `dist/`
- Node version: 18
- Environment: Demo

**Environment Variables (Netlify):**
```bash
VITE_USE_MOCK_API=true
VITE_ENV=demo
VITE_ANALYTICS_ENABLED=false
VITE_DEMO_CTA_TRIAL_URL=https://securebase.io/signup
VITE_DEMO_CTA_BOOK_DEMO_URL=https://securebase.io/contact
```

---

## 🚀 Netlify Configuration

### Two Separate Netlify Sites Required

SecureBase requires **two distinct Netlify sites** to be configured:

#### Site 1: Marketing Site

| Setting | Value |
|---------|-------|
| **Site Name** | `securebase` (or custom) |
| **Domain** | `securebase.io` |
| **Repository** | `github.com/cedrickbyrd/securebase-app` |
| **Base Directory** | `/` (root) |
| **Build Command** | `npm run build` |
| **Publish Directory** | `dist` |
| **Branch** | `main` |

**DNS Configuration:**
```
securebase.io        A      75.2.60.5
www.securebase.io    CNAME  securebase.netlify.app
```

---

#### Site 2: Portal Demo

| Setting | Value |
|---------|-------|
| **Site Name** | `securebase-demo` (or custom) |
| **Domain** | `demo.securebase.io` |
| **Repository** | `github.com/cedrickbyrd/securebase-app` |
| **Base Directory** | `phase3a-portal` |
| **Build Command** | `npm run build` |
| **Publish Directory** | `dist` |
| **Branch** | `main` |

**DNS Configuration:**
```
demo.securebase.io   CNAME  securebase-demo.netlify.app
```

**Required Environment Variables:**
Set these in Netlify Dashboard → Site settings → Environment variables:
```
VITE_USE_MOCK_API=true
VITE_ENV=demo
VITE_ANALYTICS_ENABLED=false
VITE_DEMO_CTA_TRIAL_URL=https://securebase.io/signup
VITE_DEMO_CTA_BOOK_DEMO_URL=https://securebase.io/contact
```

---

## 🔧 Deployment Procedures

### Option 1: Automatic Deployment (Recommended)

Both sites deploy automatically via GitHub integration:

1. **Push to `main` branch** triggers automatic builds
2. **Netlify detects changes** in respective directories
3. **Builds execute** using `netlify.toml` configurations
4. **Sites deploy** to production URLs

**Deployment Time:** 2-4 minutes per site

---

### Option 2: Manual CLI Deployment

For manual or scripted deployments:

#### Marketing Site
```bash
# From repository root
npm install
npm run build
netlify deploy --prod
```

#### Portal Demo
```bash
# From phase3a-portal directory
cd phase3a-portal
npm install
npm run build
netlify deploy --prod
```

**Deployment Scripts Available:**
- `deploy-demo-netlify.sh` - Automated demo deployment
- `phase3a-portal/deploy-demo.sh` - Portal-specific deployment

---

### Option 3: GitHub Actions (CI/CD)

GitHub Actions workflow available for portal demo:

**Workflow File:** `.github/workflows/deploy-phase3a-demo.yml`

**Trigger:**
- Automatically on push to `main` or `feature/sales-enablement`
- Manually via GitHub Actions UI

**What it does:**
1. Checks out repository
2. Sets up Node.js 18
3. Installs dependencies
4. Builds portal with demo environment variables
5. Deploys to configured S3 bucket or Netlify

---

## 🔒 Security Configuration

Both sites include production-grade security headers configured in their respective `netlify.toml` files:

### Security Headers Applied

**Content Security Policy (CSP):**
- Prevents XSS attacks
- Restricts script sources
- Controls resource loading

**Additional Headers:**
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Strict-Transport-Security` - Enforces HTTPS
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features

**Demo-Specific Headers:**
```
X-Environment: demo
X-Robots-Tag: noindex, nofollow
```

---

## 📊 Monitoring & Operations

### Uptime Monitoring

**Recommended Tool:** UptimeRobot or Pingdom

**Endpoints to Monitor:**
- `https://securebase.io` (marketing site)
- `https://demo.securebase.io` (portal demo)

**Check Frequency:** Every 5 minutes  
**Alert Threshold:** 2 consecutive failures  
**Notification:** Email to ops@securebase.io

---

### Performance Metrics

**Target Performance:**
- **Lighthouse Score:** 90+ (performance)
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

**Monitoring Tools:**
- Google PageSpeed Insights
- Lighthouse CI (GitHub Actions)
- Netlify Analytics

---

### Build Monitoring

**Netlify Dashboard Notifications:**
- Enable build notifications via email
- Set up Slack integration for build failures
- Monitor build time trends

**Expected Build Times:**
- Marketing site: 1-2 minutes
- Portal demo: 2-3 minutes

**Build Failure Protocol:**
1. Check Netlify deploy logs
2. Verify `package.json` dependencies
3. Test build locally: `npm run build`
4. Review recent commits
5. Rollback to last known good deployment if needed

---

## 🔄 Rollback Procedures

### Netlify Rollback (Fastest)

**Via Dashboard:**
1. Go to Netlify site dashboard
2. Navigate to "Deploys" tab
3. Find last successful deploy
4. Click "..." menu → "Publish deploy"

**Via CLI:**
```bash
netlify deploy --alias rollback
```

---

### Git Rollback

**For catastrophic failures:**
```bash
# Identify last good commit
git log --oneline

# Revert to specific commit
git revert <commit-hash>

# Push to trigger redeploy
git push origin main
```

---

## 💰 Cost Analysis

### Netlify Pricing (Current Plan)

**Free Tier Limits:**
- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites
- SSL included
- CDN included

**Current Usage (Estimated):**
- Marketing site: ~2 GB/month bandwidth
- Portal demo: ~3 GB/month bandwidth
- Builds: ~40 minutes/month
- **Total Cost:** $0/month (within free tier)

**Upgrade Path:**
- **Starter:** $19/month (if exceeding limits)
- **Pro:** $99/month (team features, faster builds)

---

## 🔗 Alternative Deployment Platforms

While Netlify is the primary platform, configurations exist for alternatives:

### AWS S3 + CloudFront (Production)

**Configuration:** Can use existing build output  
**Current Use:** Production environment  
**URL:** `securebase.io`  

**Deploy Command:**
```bash
aws s3 sync dist/ s3://your-bucket-name
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

---

### AWS S3 + CloudFront (Production Alternative)

**Configuration:** `phase3a-portal/deploy-demo.sh`  
**Use Case:** Enterprise-scale production deployments  
**Cost:** ~$1-5/month depending on traffic

**Deploy Command:**
```bash
cd phase3a-portal
./deploy-demo.sh
```

---

### GitHub Pages (Open Source/Free)

**Configuration:** `.github/workflows/` + `deploy-demo-github-pages.sh`  
**Use Case:** Free hosting for open-source projects  
**Cost:** $0/month

**Deploy Command:**
```bash
./deploy-demo-github-pages.sh
```

---

## 📝 URL Reference Guide

### Production URLs

| Purpose | URL | Platform | Source |
|---------|-----|----------|--------|
| **Marketing Site** | https://securebase.io | Netlify | Root `/` |
| **Portal Demo** | https://demo.securebase.io | Netlify | `phase3a-portal/` |
| **Signup** | https://securebase.io/signup | Netlify | Root (future) |
| **Contact** | https://securebase.io/contact | Netlify | Root (future) |

### Deprecated/Legacy URLs

| Old URL | New URL | Status |
|---------|---------|--------|
| ~~portal.securebase.io/signup~~ | securebase.io/signup | ❌ Deprecated |
| ~~calendly.com/securebase/demo~~ | securebase.io/contact | ❌ Deprecated |

**Migration Date:** February 5, 2026  
**Backward Compatibility:** None required (internal links only)

---

## ✅ Deployment Checklist

Use this checklist for new deployments or major updates:

### Pre-Deployment

- [ ] Test build locally: `npm run build`
- [ ] Verify `dist/` directory created successfully
- [ ] Check for console errors in browser
- [ ] Run Lighthouse audit locally
- [ ] Review security headers: https://securityheaders.com
- [ ] Verify environment variables in Netlify dashboard
- [ ] Check DNS configuration is correct
- [ ] Confirm SSL certificates are valid

### Deployment

- [ ] Deploy to staging/preview first (if available)
- [ ] Smoke test staging deployment
- [ ] Deploy to production
- [ ] Verify HTTP 200 status on all pages
- [ ] Test all CTAs and navigation links
- [ ] Confirm demo banner appears (portal only)
- [ ] Check mobile responsiveness
- [ ] Verify no JavaScript console errors

### Post-Deployment

- [ ] Monitor Netlify deploy logs for errors
- [ ] Check uptime monitoring dashboard
- [ ] Test from multiple browsers (Chrome, Firefox, Safari)
- [ ] Test from mobile devices
- [ ] Verify analytics are tracking (if enabled)
- [ ] Update status page (if applicable)
- [ ] Notify team via Slack/email
- [ ] Document any issues in runbook

---

## 🆘 Troubleshooting

### Common Issues

#### Build Fails: "npm ERR! code ELIFECYCLE"

**Cause:** Dependency installation failure

**Solution:**
```bash
# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Clean install
npm install

# Test build
npm run build
```

---

#### Site Shows 404 on Refresh

**Cause:** Missing SPA redirect configuration

**Solution:** Verify `netlify.toml` contains:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

#### Demo Banner Not Appearing

**Cause:** Environment variable not set

**Solution:** In Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add: `VITE_USE_MOCK_API=true`
3. Redeploy site

---

#### Security Headers Missing

**Cause:** `netlify.toml` not in correct directory

**Solution:** Verify file locations:
- Marketing: `/netlify.toml`
- Portal: `/phase3a-portal/netlify.toml`

---

## 📞 Support & Escalation

### Deployment Issues

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Build Failures | dev-team@securebase.io | < 1 hour |
| DNS Issues | ops@securebase.io | < 2 hours |
| Security Concerns | security@securebase.io | < 30 minutes |
| Netlify Platform | support@netlify.com | 24-48 hours |

---

## 🔄 Maintenance Schedule

### Regular Maintenance

**Weekly:**
- Review Netlify build logs
- Check uptime percentage
- Monitor bandwidth usage

**Monthly:**
- Audit security headers
- Review performance metrics
- Update dependencies (security patches)

**Quarterly:**
- Lighthouse performance audit
- SSL certificate renewal check (automatic via Netlify)
- Cost analysis and optimization

---

## 📚 Related Documentation

- [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) - Detailed Netlify setup
- [DEMO_ENVIRONMENT.md](./phase3a-portal/DEMO_ENVIRONMENT.md) - Demo configuration
- [DEMO_README.md](./DEMO_README.md) - Demo environment overview
- [SECURITY.md](./SECURITY.md) - Security policies
- [phase3a-portal/README.md](./phase3a-portal/README.md) - Portal documentation

---

## 📊 Deployment Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub Repository                          │
│                  github.com/cedrickbyrd/securebase-app           │
└────────────┬──────────────────────────────┬─────────────────────┘
             │                              │
             │                              │
    ┌────────▼────────┐            ┌────────▼────────────┐
    │   Root (/)      │            │  phase3a-portal/    │
    │  Marketing Site │            │    Portal Demo      │
    └────────┬────────┘            └────────┬────────────┘
             │                              │
             │ npm run build                │ npm run build
             │                              │
    ┌────────▼────────┐            ┌────────▼────────────┐
    │   dist/         │            │    dist/            │
    │  (Marketing)    │            │   (Portal)          │
    └────────┬────────┘            └────────┬────────────┘
             │                              │
             │ Netlify Deploy               │ Netlify Deploy
             │                              │
    ┌────────▼────────────┐        ┌────────▼─────────────────┐
    │   Netlify CDN       │        │     Netlify CDN          │
    │  securebase.io      │        │  demo.securebase.io      │
    └─────────────────────┘        └──────────────────────────┘
             │                              │
             │                              │
    ┌────────▼──────────────────────────────▼─────────────────┐
    │              End Users / Customers                       │
    │  - Marketing site visitors                               │
    │  - Demo users                                           │
    │  - Sales prospects                                      │
    └──────────────────────────────────────────────────────────┘
```

---

**Last Updated:** February 5, 2026  
**Document Version:** 1.0  
**Maintained By:** DevOps Team  
**Next Review:** March 5, 2026
