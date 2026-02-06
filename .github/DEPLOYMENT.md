# SecureBase Deployment Guide

## Overview

This guide covers the automated deployment pipeline for SecureBase's frontend application, including configuration, troubleshooting, and manual deployment procedures.

## Architecture

```
┌─────────────────┐
│   Pull Request  │
└────────┬────────┘
         │
         ├─> Quality Validation
         ├─> Security Audit
         ├─> Netlify Preview Deploy
         └─> Performance Assessment
                │
                ▼
         ┌──────────────┐
         │  Main Branch │
         └──────┬───────┘
                │
                ├─> Production Build
                ├─> Security Scanning
                ├─> Production Deploy
                └─> Health Monitoring
```

## GitHub Secrets Configuration

### Required Secrets

Navigate to: `https://github.com/cedrickbyrd/securebase-app/settings/secrets/actions`

#### 1. NETLIFY_AUTH_TOKEN

**Purpose:** Authenticates GitHub Actions with Netlify for deployments

**How to obtain:**
1. Log in to Netlify at https://app.netlify.com
2. Navigate to User Settings → Applications
3. Click "New access token" under Personal access tokens
4. Name it "GitHub Actions SecureBase"
5. Copy the generated token
6. Add to GitHub as `NETLIFY_AUTH_TOKEN`

#### 2. NETLIFY_SITE_ID

**Purpose:** Identifies which Netlify site to deploy to

**How to obtain:**
1. Log in to Netlify
2. Select your "securebase-app" site
3. Go to Site Settings → General → Site details
4. Copy the "API ID" value
5. Add to GitHub as `NETLIFY_SITE_ID`

#### 3. SNYK_TOKEN (Optional but Recommended)

**Purpose:** Enables advanced security vulnerability scanning

**How to obtain:**
1. Sign up at https://snyk.io (free for open source)
2. Go to Account Settings → API Token
3. Copy your API token
4. Add to GitHub as `SNYK_TOKEN`

**Note:** If not configured, security scanning will continue but with limited functionality.

## Workflow Triggers

### securebase-frontend-pipeline.yml

**Triggers on:**
- Push to `main` branch (production deployment)
- Pull requests to `main` (preview deployment)
- Manual workflow dispatch

**Jobs:**
1. **quality-validation** - Lints code, builds application, validates artifacts, checks bundle size
2. **dependency-audit** - Scans for security vulnerabilities
3. **netlify-deployment** - Deploys to Netlify (production or preview)
4. **performance-assessment** - Runs Lighthouse performance analysis

**Outputs:**
- Build artifacts stored for 5 days
- Deployment URL posted in PR comments
- Performance scores reported

### securebase-pr-checks.yml

**Triggers on:**
- Pull request opened/updated to `main` or `develop`

**Jobs:**
1. **pr-validation** - Quick validation of code quality and build success

**Outputs:**
- Success/failure comment on PR

### securebase-health-monitor.yml

**Triggers on:**
- Daily at 9:00 AM UTC (scheduled)
- Manual workflow dispatch

**Jobs:**
1. **monitor-production** - Checks site availability, SSL certificate, critical endpoints

**Outputs:**
- Creates GitHub issue if health check fails

### securebase-dependency-security.yml

**Triggers on:**
- Pull requests to `main` (dependency review)
- Weekly on Mondays at midnight UTC (full audit)

**Jobs:**
1. **analyze-dependencies** - Reviews dependency changes and security

**Outputs:**
- PR comments with dependency review
- GitHub issues for security vulnerabilities

## Deployment Process

### Automatic Deployment (Recommended)

**For Production:**
1. Create a pull request with your changes
2. Wait for all checks to pass
3. Review the preview deployment
4. Merge to `main` branch
5. Automatic production deployment begins

**For Preview:**
1. Open a pull request
2. Preview URL will be posted in PR comments within 5-10 minutes
3. Test your changes on the preview URL

### Manual Deployment

If automated deployment fails or you need to deploy manually:

**Prerequisites:**
- Netlify CLI installed: `npm install -g netlify-cli`
- Netlify authentication configured: `netlify login`

**Steps:**

```bash
# 1. Build the application locally
npm install
npm run build

# 2. Deploy to Netlify
netlify deploy --prod --dir=dist --site=YOUR_SITE_ID

# Or for preview deployment
netlify deploy --dir=dist --site=YOUR_SITE_ID
```

## Troubleshooting

### Build Failures

**Symptom:** Build job fails with "vite not found"

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Symptom:** CSS not generating or Tailwind errors

**Solution:**
- Verify `postcss.config.js` exists in project root
- Check that `tailwind.config.js` has correct content paths
- Ensure `autoprefixer` and `postcss` are in devDependencies

### Deployment Failures

**Symptom:** Netlify deployment times out

**Solution:**
- Check Netlify status at https://www.netlifystatus.com
- Verify NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID secrets are correct
- Try manual deployment to isolate the issue

**Symptom:** Deployment succeeds but site shows 404

**Solution:**
- Verify `dist/index.html` exists in build artifacts
- Check netlify.toml redirect rules
- Ensure publish directory is set to `dist`

### Performance Test Failures

**Symptom:** Lighthouse scores below thresholds

**Solution:**
- Review Lighthouse report artifacts in workflow
- Common issues:
  - Large bundle size → Use code splitting
  - Missing image optimization → Add lazy loading
  - Blocking resources → Defer non-critical scripts
- Adjust thresholds in `.lighthouserc.json` if necessary

### Security Scan Failures

**Symptom:** Dependency audit finds vulnerabilities

**Solution:**
```bash
# Review vulnerabilities
npm audit

# Attempt automatic fixes
npm audit fix

# For breaking changes, update manually
npm update package-name

# Rebuild and test
npm run build
npm run lint
```

## Rollback Procedures

### Emergency Rollback

If a production deployment causes issues:

**Option 1: Rollback via Netlify UI**
1. Log in to Netlify
2. Go to Deploys tab
3. Find the last working deployment
4. Click "Publish deploy"

**Option 2: Revert Git Commit**
```bash
# Find the commit hash of the last working version
git log --oneline

# Revert the problematic commit
git revert <commit-hash>

# Push to trigger new deployment
git push origin main
```

**Option 3: Manual Deploy Previous Build**
```bash
# Checkout previous version
git checkout <previous-commit-hash>

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

## Monitoring

### Key Metrics

Monitor these in GitHub Actions:
- Build success rate
- Average build time (target: <5 minutes)
- Bundle size (target: <5MB)
- Lighthouse performance score (target: ≥90)

### Health Check Monitoring

- Daily automated health checks at 9 AM UTC
- Monitors: HTTP status, SSL certificate, endpoint availability
- Creates GitHub issue on failure
- Review issues labeled `production`, `incident`, `health-check`

## Bundle Size Management

Current threshold: **5MB (5120 KB)**

**To check bundle size locally:**
```bash
npm run build
du -sh dist/
```

**To reduce bundle size:**
1. Analyze bundle composition:
   ```bash
   npx vite-bundle-visualizer
   ```

2. Implement code splitting in `vite.config.js`:
   ```javascript
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor': ['react', 'react-dom'],
           'icons': ['lucide-react']
         }
       }
     }
   }
   ```

3. Remove unused dependencies:
   ```bash
   npx depcheck
   ```

## Performance Optimization

### Current Targets

| Metric | Target | Current |
|--------|--------|---------|
| Performance | ≥90 | Measured on deploy |
| Accessibility | ≥95 | Measured on deploy |
| Best Practices | ≥95 | Measured on deploy |
| SEO | ≥95 | Measured on deploy |
| First Contentful Paint | <2s | Warning threshold |
| Largest Contentful Paint | <2.5s | Warning threshold |

### Optimization Checklist

- [ ] Enable asset compression (gzip/brotli)
- [ ] Implement lazy loading for images
- [ ] Use code splitting for routes
- [ ] Minimize CSS bundle size
- [ ] Optimize font loading
- [ ] Enable browser caching headers
- [ ] Use CDN for static assets

## Contact and Support

For deployment issues or questions:
- GitHub Issues: https://github.com/cedrickbyrd/securebase-app/issues
- Netlify Support: https://www.netlify.com/support/
- Project Lead: Check repository CODEOWNERS

## Appendix

### Workflow Status Badges

Add these to your README for visibility:

```markdown
[![SecureBase Frontend Pipeline](https://github.com/cedrickbyrd/securebase-app/workflows/SecureBase%20Frontend%20Pipeline/badge.svg)](https://github.com/cedrickbyrd/securebase-app/actions)
[![Health Monitor](https://github.com/cedrickbyrd/securebase-app/workflows/SecureBase%20Health%20Monitor/badge.svg)](https://github.com/cedrickbyrd/securebase-app/actions)
[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-SITE-ID/deploy-status)](https://app.netlify.com/sites/securebase-app/deploys)
```

### Additional Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
