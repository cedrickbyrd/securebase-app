# Netlify Deployment Workflows

This document covers the automated workflows for deploying and setting up SecureBase sites on Netlify.

## Workflows

1. **Setup Marketing Site** (`setup-marketing-site.yml`) - Automated site creation and configuration
2. **Deploy Marketing Site** (`deploy-marketing-site.yml`) - Continuous deployment for marketing site
3. **Deploy Demo Portal** (`deploy-phase3a-demo.yml`) - Continuous deployment for demo portal

## Overview

The deployment system manages two sites:
1. **Marketing Site** (`securebase.io`) - Root marketing site
2. **Demo Portal** (`demo.securebase.io`) - Customer portal demo

---

## Setup Marketing Site Workflow

### Purpose

This workflow automates the initial creation and configuration of the marketing site in Netlify. It eliminates the need for manual site setup through the Netlify UI.

### When to Use

Run this workflow when:
- Setting up the marketing site for the first time
- The `NETLIFY_MARKETING_SITE_ID` secret is missing or incorrect
- You need to recreate the marketing site

### How to Run

1. Go to **Actions** tab in GitHub
2. Select **"Setup Marketing Site in Netlify"** workflow
3. Click **"Run workflow"** button
4. Select branch (usually `main`)
5. Click **"Run workflow"** to start

### What It Does

The workflow performs these steps automatically:

1. **Check if site exists**
   - Verifies if `NETLIFY_MARKETING_SITE_ID` secret exists
   - Checks if the site exists in Netlify
   - Skips creation if site is already configured

2. **Create marketing site** (if needed)
   - Creates new Netlify site with name `securebase-marketing`
   - Links to GitHub repository `cedrickbyrd/securebase-app`
   - Configures build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
     - Node version: `22.12.0`
   - Sets environment variables:
     - `VITE_ENV=production`
     - `NODE_VERSION=22.12.0`

3. **Configure build settings**
   - Updates site configuration via Netlify API
   - Ensures all environment variables are set

4. **Update GitHub secret**
   - Automatically creates/updates `NETLIFY_MARKETING_SITE_ID` secret
   - Uses GitHub API with encrypted secret storage

5. **Trigger initial deployment**
   - Starts first deployment of the site
   - Waits for deployment to complete (up to 5 minutes)
   - Reports deployment status

6. **Report results**
   - Creates GitHub Actions summary with:
     - Site ID and URL
     - Deployment status
     - Links to Netlify dashboard
     - Next steps for domain configuration

### Success Criteria

- ✅ Site created in Netlify (or confirmed existing)
- ✅ GitHub secret `NETLIFY_MARKETING_SITE_ID` updated
- ✅ Initial deployment triggered and completed
- ✅ Site accessible via Netlify URL
- ✅ Build settings configured correctly

### Troubleshooting

#### Error: "NETLIFY_AUTH_TOKEN not found"

**Solution**:
1. Go to [Netlify User Applications](https://app.netlify.com/user/applications)
2. Click "New access token"
3. Copy the token
4. Add to GitHub: Settings → Secrets → Actions → New repository secret
5. Name: `NETLIFY_AUTH_TOKEN`
6. Paste token value
7. Re-run the workflow

#### Error: "Failed to create site"

**Possible causes**:
- Netlify account limit reached (check your plan)
- Invalid authentication token
- API rate limiting

**Solution**:
1. Check workflow logs for specific error message
2. Verify token has correct permissions
3. Check Netlify account status
4. Wait a few minutes if rate limited, then retry

#### Error: "Failed to update GitHub secret"

**Cause**: Insufficient permissions for GITHUB_TOKEN

**Solution**:
1. Check repository settings → Actions → General
2. Ensure "Read and write permissions" is enabled
3. Or add a Personal Access Token (PAT) with `repo` scope as `GH_PAT` secret

#### Warning: "PyNaCl not installed"

**Impact**: Automatic - workflow installs PyNaCl during execution

**Details**: PyNaCl is required to encrypt GitHub secrets. The workflow automatically installs it if missing.

#### Deployment timeout

**Cause**: Deployment taking longer than 5 minutes

**Solution**:
1. Check Netlify dashboard for deployment status
2. Build may still succeed even if workflow times out
3. Verify at: `https://app.netlify.com/sites/{SITE_ID}/deploys`

### Verification Steps

After workflow completes successfully:

1. **Check GitHub Actions summary**
   - Review site ID, URL, and deployment status
   - Click links to verify

2. **Verify GitHub secret**
   - Go to Settings → Secrets → Actions
   - Confirm `NETLIFY_MARKETING_SITE_ID` exists

3. **Check Netlify dashboard**
   - Visit [Netlify dashboard](https://app.netlify.com)
   - Find site named `securebase-marketing`
   - Verify deployment completed

4. **Test site accessibility**
   - Click site URL from workflow summary
   - Verify page loads correctly

5. **Configure custom domain** (optional)
   - Go to site Settings → Domain management
   - Add custom domain: `securebase.io`
   - Follow DNS configuration instructions

### Next Steps After Setup

1. **Configure custom domain**: Add `securebase.io` in Netlify dashboard
2. **Set up SSL**: Netlify automatically provisions SSL certificates
3. **Test deployment workflow**: Push changes to trigger automatic deployment
4. **Monitor deployments**: Check Netlify dashboard for build status

---

## Deploy Marketing Site Workflow

### Purpose

Automatically deploys the marketing site to Netlify on every push to `main` or when manually triggered.

### Workflow Jobs

#### 1. `deploy-marketing`
Deploys the marketing site to Netlify.

- **Build Command**: `npm run build`
- **Build Directory**: Root directory
- **Publish Directory**: `dist/`
- **Environment**: `VITE_ENV=production`
- **Netlify Site**: Uses `NETLIFY_MARKETING_SITE_ID` secret

#### 2. `verify-production`
Verifies the production deployment (only runs on `main` branch).

- Waits 15 seconds for DNS propagation
- Tests `https://securebase.io` returns HTTP 200
- Checks security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Generates deployment report in GitHub Actions

### Triggers

The deployment workflow runs on:
- **Push to `main`**: Production deployment
- **Pull Request to `main`**: Preview deployment with PR comment
- **Manual trigger**: Via GitHub Actions UI (`workflow_dispatch`)

---

## Required Secrets

All workflows require these secrets to be configured in GitHub repository settings:

### `NETLIFY_AUTH_TOKEN`
Your Netlify personal access token

**How to get**:
1. Go to https://app.netlify.com/user/applications
2. Click "New access token"
3. Copy the token
4. Add to GitHub: Settings → Secrets → Actions → New repository secret

### `NETLIFY_MARKETING_SITE_ID`
Site ID for marketing site (securebase.io)

**How to get**:
- **Option 1**: Run the "Setup Marketing Site in Netlify" workflow (recommended)
- **Option 2**: Manual setup:
  1. Go to your Netlify site
  2. Settings → General → Site details
  3. Copy "API ID"
  4. Add to GitHub as repository secret

### `GITHUB_TOKEN`
Automatically provided by GitHub Actions (no setup needed)

**Used for**:
- Updating repository secrets
- Posting PR comments
- Creating deployment statuses

---

## Quick Start Guide

### First Time Setup

1. **Get Netlify auth token**
   ```
   → Visit: https://app.netlify.com/user/applications
   → Create new access token
   → Copy token
   ```

2. **Add token to GitHub**
   ```
   → Go to: Settings → Secrets → Actions
   → New repository secret
   → Name: NETLIFY_AUTH_TOKEN
   → Paste token
   → Save
   ```

3. **Run setup workflow**
   ```
   → Go to: Actions → Setup Marketing Site in Netlify
   → Click "Run workflow"
   → Select "main" branch
   → Click "Run workflow"
   → Wait for completion (~5 minutes)
   ```

4. **Verify setup**
   ```
   → Check workflow summary for site URL
   → Visit Netlify dashboard to confirm site exists
   → Check Settings → Secrets for NETLIFY_MARKETING_SITE_ID
   ```

5. **Configure domain (optional)**
   ```
   → Go to Netlify dashboard
   → Site Settings → Domain management
   → Add custom domain: securebase.io
   → Follow DNS configuration instructions
   ```

### Subsequent Deployments

After initial setup, deployments happen automatically:
- Push to `main` → Automatic production deployment
- Open PR → Automatic preview deployment with URL comment

---

## Features

- ✅ Automated site creation and configuration
- ✅ Automatic deployments on push to main
- ✅ PR preview deployments with comment URLs
- ✅ Production vs preview environment detection
- ✅ GitHub Actions summary with deployment status
- ✅ Security header verification
- ✅ HTTP 200 health checks
- ✅ Retry logic for API calls
- ✅ Deployment timeout protection (8 minutes max)
- ✅ Node.js 22 with dependency caching
- ✅ Environment variable configuration
- ✅ Encrypted GitHub secret storage

## Manual Deployment

To manually trigger a deployment:

1. Go to Actions tab in GitHub
2. Select "Deploy Marketing Site (securebase.io)" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

## Deployment Flow

### Setup Flow (First Time):
```
1. Run "Setup Marketing Site" workflow
2. Check if site exists
3. Create site if needed
4. Configure build settings
5. Update GitHub secret
6. Trigger initial deployment
7. Report results with site URL
```

### Regular Deployment Flow:
```
On Push to Main:
1. deploy-marketing           → Marketing site deployed
2. verify-production          → Site verified (HTTP 200 + security headers)
3. GitHub Actions summary     → Deployment status displayed

On Pull Request:
1. deploy-marketing           → Preview deployment
2. PR comment with URL        → Preview link posted
3. verify-production          → Skipped (only runs on main)
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
