# Netlify Deployment Workflow

This workflow automates the deployment of both the SecureBase marketing site and demo portal to Netlify.

## Overview

The workflow deploys two sites:
1. **Marketing Site** (`securebase.io`) - Root marketing site
2. **Demo Portal** (`demo.securebase.io`) - Customer portal demo

## Workflow Jobs

### 1. `deploy-marketing`
Deploys the marketing site to Netlify.

- **Build Command**: `npm run build`
- **Build Directory**: Root directory
- **Publish Directory**: `dist/`
- **Environment**: `VITE_ENV=demo`
- **Netlify Site**: Uses `NETLIFY_MARKETING_SITE_ID` secret

### 2. `deploy-portal-demo`
Deploys the demo portal to Netlify.

- **Build Command**: `npm run build`
- **Build Directory**: `phase3a-portal/`
- **Publish Directory**: `phase3a-portal/dist/`
- **Environment Variables**:
  - `VITE_USE_MOCK_API=true`
  - `VITE_ENV=demo`
  - `VITE_ANALYTICS_ENABLED=false`
- **Netlify Site**: Uses `NETLIFY_DEMO_SITE_ID` secret
- **Additional**: Copies `demo-data.json` if it exists

### 3. `verify-deployments`
Verifies both deployments (only runs on `main` branch).

- Waits 10 seconds for DNS propagation
- Tests `https://securebase.io` returns HTTP 200
- Tests `https://demo.securebase.io` returns HTTP 200
- Generates deployment summary in GitHub Actions

## Triggers

The workflow runs on:
- **Push to `main`**: Production deployment
- **Pull Request to `main`**: Preview deployment with PR comment
- **Manual trigger**: Via GitHub Actions UI

## Required Secrets

The following secrets must be configured in GitHub repository settings:

- `NETLIFY_AUTH_TOKEN` - Your Netlify personal access token
- `NETLIFY_MARKETING_SITE_ID` - Site ID for marketing site (securebase.io)
- `NETLIFY_DEMO_SITE_ID` - Site ID for demo portal (demo.securebase.io)

### How to Get Netlify Secrets

1. **NETLIFY_AUTH_TOKEN**:
   - Go to https://app.netlify.com/user/applications
   - Click "New access token"
   - Copy the token

2. **NETLIFY_SITE_ID**:
   - Go to your Netlify site
   - Settings → General → Site details
   - Copy "API ID"

3. **Add to GitHub**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add each secret

## Features

- ✅ Automatic deployments on push to main
- ✅ PR preview deployments with comment URLs
- ✅ Production vs preview environment detection
- ✅ GitHub Actions summary with deployment status
- ✅ HTTP 200 verification checks
- ✅ 5-minute timeout per job
- ✅ Node.js 20 with dependency caching
- ✅ Independent deployments (marketing and portal run in parallel)

## Manual Deployment

To manually trigger a deployment:

1. Go to Actions tab in GitHub
2. Select "Deploy to Netlify" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

## Deployment Flow

### On Push to Main:
```
1. deploy-marketing (parallel)  → Marketing site deployed
2. deploy-portal-demo (parallel) → Demo portal deployed
3. verify-deployments            → Both sites verified (HTTP 200)
4. GitHub Actions summary        → Deployment status displayed
```

### On Pull Request:
```
1. deploy-marketing (parallel)  → Preview deployment + PR comment
2. deploy-portal-demo (parallel) → Preview deployment + PR comment
3. verify-deployments            → Skipped (only runs on main)
```

## Troubleshooting

### Deployment Fails: "NETLIFY_AUTH_TOKEN not found"
- Check that secrets are configured in repository settings
- Verify secret names match exactly

### Build Fails: Dependencies Error
- Check that `package.json` and `package-lock.json` are up to date
- Verify Node.js version compatibility (workflow uses Node 20)
- Note: The root project uses `rolldown-vite@7.2.5` which requires Node 20.19+ or 22.12+

### Verification Fails: HTTP 200 Check
- Check that custom domains are configured in Netlify
- Verify DNS settings are correct
- Allow time for DNS propagation (can take up to 48 hours)

### PR Comment Not Posted
- Check that `GITHUB_TOKEN` has correct permissions
- Verify `enable-pull-request-comment: true` is set in workflow

## Deployment Timeline

- Build time: ~2-3 minutes per site
- Deployment time: ~30 seconds per site
- Verification time: ~10-15 seconds
- **Total**: ~6-8 minutes for full workflow

## Related Documentation

- [NETLIFY_DEPLOYMENT.md](../../NETLIFY_DEPLOYMENT.md) - Netlify deployment guide
- [DEMO_README.md](../../DEMO_README.md) - Demo environment overview
- [netlify.toml](../../netlify.toml) - Marketing site Netlify config
- [phase3a-portal/netlify.toml](../../phase3a-portal/netlify.toml) - Portal Netlify config

## Support

For issues with this workflow:
- Create an issue in the repository
- Check GitHub Actions logs for detailed error messages
- Review Netlify deployment logs at https://app.netlify.com

---

**Last Updated**: February 2026  
**Status**: ✅ Production Ready
