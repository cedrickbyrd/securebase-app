# 🚀 Netlify Deployment Guide

## Quick Deploy to demo.securebase.tximhotep.com

SecureBase marketing site is ready for immediate deployment to Netlify.

---

## 🔄 Automated Deployments via GitHub Actions

### Marketing Site Workflow (securebase.tximhotep.com)

**File**: `.github/workflows/deploy-marketing-site.yml`

**Triggers:**
- Push to `main` branch (auto-deploy to production)
- Pull requests to `main` (preview deployment)
- Manual workflow dispatch

**Path filters:**
- Deploys only when marketing site files change (`src/`, `public/`, etc.)

**Required Secrets:**
- `NETLIFY_AUTH_TOKEN` - Your Netlify personal access token
- `NETLIFY_MARKETING_SITE_ID` - Netlify site ID for securebase.tximhotep.com

**Features:**
- ✅ Automatic production deployment on merge to main
- ✅ Preview deployments for PRs with unique URLs
- ✅ Health checks and security header validation
- ✅ Deployment summaries in GitHub Actions UI

---

### Demo Portal Workflow (demo.securebase.tximhotep.com)

**File**: `.github/workflows/deploy-demo-portal.yml`

**Triggers:**
- Push to `main` branch (auto-deploy to production)
- Pull requests to `main` (preview deployment)
- Manual workflow dispatch
- **After marketing site deployment completes** (workflow_run trigger)

**Dependency:**
- ⚠️ **Checks if `securebase.tximhotep.com` exists and is healthy before deploying**
- If marketing site is down, demo portal deployment is skipped (unless manually triggered)

**Path filters:**
- Deploys only when demo portal files change (`phase3a-portal/**`)

**Required Secrets:**
- `NETLIFY_AUTH_TOKEN` - Your Netlify personal access token
- `NETLIFY_DEMO_SITE_ID` - Netlify site ID for demo.securebase.tximhotep.com

**Features:**
- ✅ Validates marketing site health before deployment
- ✅ Independent deployment pipeline
- ✅ Automatically triggered after marketing site updates
- ✅ Can be manually triggered even if marketing site check fails

---

### Workflow Execution Order

1. **Marketing Site deploys first** (independent)
2. **Demo Portal checks marketing site health**
3. **If healthy → Demo Portal deploys**
4. **If unhealthy → Demo Portal skips (unless manual)**

### Manual Deployment

To manually trigger either workflow:
1. Go to **Actions** tab
2. Select the workflow
3. Click **Run workflow**
4. Choose the branch
5. Click **Run workflow** button

---

## Option 1: One-Click Deploy (Fastest ⚡)

### Via Netlify Dashboard

1. **Connect Repository**
   - Go to [Netlify Dashboard](https://app.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Select "GitHub" and authorize
   - Choose `cedrickbyrd/securebase-app` repository

2. **Configuration Auto-Detected**
   - Netlify will read `netlify.toml` automatically
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

3. **Deploy**
   - Click "Deploy site"
   - Wait 2-3 minutes for build
   - Site will be live at `https://tximhotep.com`

4. **Custom Domain (Optional)**
   - Go to Site settings → Domain management
   - Add custom domain: `tximhotep.com`
   - Configure DNS:
     ```
     tximhotep.com  CNAME  [your-site].netlify.app
     ```

---

## Option 2: CLI Deploy (Developers 👨‍💻)

### Prerequisites
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login
```

### Deploy
```bash
# Build the site
npm install
npm run build

# Deploy to Netlify
netlify deploy --prod
```

### First-Time Setup
```bash
# Initialize Netlify site
netlify init

# Follow prompts:
# - Create new site
# - Team: Select your team
# - Site name: demo-securebase
# - Build command: npm run build
# - Publish directory: dist
```

---

## Configuration Details

### Build Settings (from netlify.toml)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  VITE_ENV = "demo"
```

### Security Headers Included

The deployment includes production-grade security headers:

- ✅ **Content Security Policy (CSP)** - XSS protection
- ✅ **X-Frame-Options: DENY** - Clickjacking prevention
- ✅ **Strict-Transport-Security** - HTTPS enforcement
- ✅ **X-Content-Type-Options** - MIME sniffing prevention
- ✅ **Referrer-Policy** - Privacy controls
- ✅ **Permissions-Policy** - Feature restrictions

### Performance Optimizations

- ✅ **Asset Caching**: 1 year cache for `/assets/*`
- ✅ **No HTML Caching**: Fresh `index.html` on every request
- ✅ **SPA Redirects**: All routes serve `index.html`

---

## Multi-Site Deployment

### Root Marketing Site
- **Config**: `netlify.toml` (repository root)
- **Source**: `src/`
- **Build**: `npm run build`
- **Output**: `dist/`
- **Deploy to**: `demo.securebase.tximhotep.com`

### Customer Portal
- **Config**: `phase3a-portal/netlify.toml`
- **Source**: `phase3a-portal/src/`
- **Build**: `cd phase3a-portal && npm run build`
- **Output**: `phase3a-portal/dist/`
- **Deploy to**: `portal-demo.securebase.tximhotep.com`

To deploy both:
```bash
# Deploy marketing site
netlify deploy --prod

# Deploy portal (requires separate Netlify site)
cd phase3a-portal
netlify deploy --prod
```

---

## Environment Variables

### Marketing Site (Root)
No environment variables required. Pure static site.

### Portal (phase3a-portal)
Set these in Netlify dashboard → Site settings → Environment variables:

```bash
VITE_USE_MOCK_API=true
VITE_ENV=demo
VITE_ANALYTICS_ENABLED=false
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Verify `netlify.toml` is in repository root
- [ ] Confirm `package.json` has `build` script
- [ ] Test build locally: `npm run build`
- [ ] Check `dist/` directory is created
- [ ] Review security headers in `netlify.toml`
- [ ] Set custom domain in Netlify dashboard
- [ ] Configure DNS CNAME record
- [ ] Enable HTTPS (automatic with Netlify)
- [ ] Test deployed site
- [ ] Verify security headers: https://securityheaders.com
- [ ] Check performance: https://pagespeed.web.dev

---

## Troubleshooting

### Build Fails: "vite: command not found"

**Solution**: Dependencies not installed. Netlify should auto-install from `package.json`. If not:

```bash
# Verify package.json exists
ls -la package.json

# Clear build cache in Netlify
# Dashboard → Site settings → Build & deploy → Clear cache and deploy
```

### Site Shows 404

**Solution**: Publish directory incorrect. Verify:

```toml
[build]
  publish = "dist"  # NOT "build" or "public"
```

### Security Headers Not Applied

**Solution**: Headers are defined in `netlify.toml`. Redeploy:

```bash
netlify deploy --prod
```

Then verify:
```bash
curl -I https://demo.securebase.tximhotep.com
```

### Custom Domain Not Working

**Solution**: DNS propagation delay (up to 48 hours). Check:

```bash
dig tximhotep.com CNAME
# Should show: tximhotep.com CNAME [your-site].netlify.app
```

---

## Monitoring

### Uptime Monitoring
- **Service**: UptimeRobot (recommended)
- **Check**: Every 5 minutes
- **Alert**: Email on downtime

### Performance Monitoring
- **Lighthouse**: Target 90+ performance score
- **Core Web Vitals**:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1

### Security Scanning
- **Mozilla Observatory**: https://observatory.mozilla.org
  - Target: A+ grade
- **Security Headers**: https://securityheaders.com
  - Target: A grade

---

## Cost

**Netlify Pricing:**
- ✅ **Free Tier**: 100GB bandwidth/month, 300 build minutes/month
- ✅ **Starter**: $19/month for increased limits
- ✅ **Pro**: $99/month for team features

**Estimated Cost for Demo Site:**
- Traffic: ~5GB/month → **FREE**
- Builds: ~20/month → **FREE**
- Custom Domain: Included → **FREE**
- SSL Certificate: Automatic → **FREE**

**Total**: $0/month on free tier ✅

---

## Alternatives

### Other Deployment Options:

| Platform | Config File | Status | Best For |
|----------|-------------|--------|----------|
| **Netlify** | `netlify.toml` | ✅ Ready | Demo sites, SPAs |
| **GitHub Pages** | `.github/workflows/` | ✅ Ready | Open source projects |
| **AWS S3 + CloudFront** | `deploy-staging.sh` | ✅ Ready | Production portal |

---

## Related Documentation

- [DEMO_README.md](DEMO_README.md) - Demo environment overview
- [DEMO_HOSTING_READINESS.md](DEMO_HOSTING_READINESS.md) - Platform comparison
- [DEMO_SECURITY_CONFIG.md](DEMO_SECURITY_CONFIG.md) - Security implementation

---

## Support

**Deployment Issues:**
- Netlify Support: https://answers.netlify.com
- Repository Issues: https://github.com/cedrickbyrd/securebase-app/issues

**Security Concerns:**
- Email: security@securebase.tximhotep.com
- Security Policy: [SECURITY.md](SECURITY.md)

---

**Last Updated:** February 3, 2026  
**Netlify Config Version:** 1.0  
**Status:** ✅ Production Ready
