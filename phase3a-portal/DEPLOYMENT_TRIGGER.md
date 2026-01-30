# Phase 3a Portal - Staging Deployment Trigger Guide

## Overview

This document explains how to trigger the staging deployment workflow for the Phase 3a Customer Portal.

## Deployment Workflow

The deployment workflow is defined in `.github/workflows/deploy-phase3a-staging.yml` and handles:
- Building the portal with staging configuration
- Deploying to AWS S3 with static website hosting
- Validating the deployment with smoke tests
- Reporting deployment status

## Trigger Methods

### Method 1: Automatic Trigger on Push to Staging Branch

The workflow automatically triggers when changes are pushed to the `staging` branch that affect files in `phase3a-portal/**`.

```bash
# Merge this PR to staging branch to trigger automatic deployment
git checkout staging
git merge copilot/deploy-phase-3a-portal-staging
git push origin staging
```

### Method 2: Automatic Trigger on Pull Request

The workflow runs on pull requests targeting the `staging` branch with changes in `phase3a-portal/**`.

```bash
# Create a PR from this branch to staging
# The workflow will run automatically for validation
# Deployment will occur after the PR is merged
```

### Method 3: Manual Workflow Dispatch

You can manually trigger the deployment from the GitHub Actions UI:

1. Go to GitHub Actions tab in the repository
2. Select "Deploy Phase 3a to Staging" workflow
3. Click "Run workflow" button
4. Select branch (default: staging)
5. Click "Run workflow" to start deployment

## Deployment Process

When triggered, the workflow executes these jobs:

### 1. Build Job
- Checks out code
- Sets up Node.js 18
- Installs dependencies with npm caching
- Runs linter (warnings allowed)
- Builds production bundle with staging env vars:
  - `VITE_API_BASE_URL` - Staging API endpoint
  - `VITE_WS_URL` - Staging WebSocket endpoint
  - `VITE_STRIPE_PUBLIC_KEY` - Test Stripe key
- Uploads build artifacts

### 2. Deploy Job
- Downloads build artifacts
- Configures AWS credentials from secrets
- Creates S3 bucket (if not exists)
- Enables static website hosting
- Sets public read bucket policy
- Syncs files to S3 with cache control headers
- Outputs staging URL

### 3. Validate Job
- Waits 30 seconds for propagation
- Checks HTTP status (expects 200)
- Validates index.html content
- Confirms deployment success

### 4. Notify Job
- Reports deployment status
- Outputs staging URL
- Notifies on failure

## Required GitHub Secrets

Ensure these secrets are configured in GitHub repository settings:

| Secret | Description | Required | Example |
|--------|-------------|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes | `wJalr...` |
| `AWS_REGION` | AWS region | No (defaults to us-east-1) | `us-east-1` |
| `STAGING_S3_BUCKET` | S3 bucket name | No (defaults to securebase-phase3a-staging) | `securebase-phase3a-staging` |
| `STAGING_API_URL` | Staging API endpoint | No (uses default) | `https://staging-api.securebase.com/v1` |
| `STAGING_WS_URL` | Staging WebSocket URL | No (uses default) | `wss://staging-ws.securebase.com` |
| `STAGING_STRIPE_PUBLIC_KEY` | Stripe test key | No (uses default) | `pk_test_...` |

## Verifying Deployment

After deployment completes:

### 1. Check Workflow Status
- Go to Actions tab in GitHub
- Verify all jobs completed successfully (green checkmark)
- Review job logs for any warnings

### 2. Access Staging Site
Default S3 website URL:
```
http://securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
```

### 3. Run Manual Tests
- [ ] Login page loads
- [ ] Authentication works with test API key
- [ ] Dashboard displays metrics
- [ ] Invoices page loads
- [ ] API keys management works
- [ ] Compliance page functional
- [ ] No console errors
- [ ] Mobile responsive

### 4. Validate Environment
Open browser DevTools and check:
- API calls go to staging endpoint
- WebSocket connects to staging
- Stripe test mode is active
- No production keys in use

## Troubleshooting

### Workflow Doesn't Trigger

**Cause:** Changes not in `phase3a-portal/**` directory

**Solution:** Ensure changes are made to files within the phase3a-portal directory

### Build Fails

**Cause:** Dependency issues or linting errors

**Solution:** 
- Check workflow logs for specific errors
- Run `npm ci && npm run build:staging` locally
- Fix errors and push again

### Deployment Fails

**Cause:** AWS credentials or permissions issues

**Solution:**
- Verify GitHub secrets are configured
- Check AWS IAM permissions for S3 access
- Ensure S3 bucket name is available

### Validation Fails

**Cause:** S3 bucket policy or website hosting not configured

**Solution:**
- Check S3 bucket is publicly accessible
- Verify static website hosting is enabled
- Check bucket policy allows GetObject

## Post-Deployment Checklist

- [ ] Workflow completed successfully
- [ ] All jobs passed (build, deploy, validate, notify)
- [ ] Staging URL is accessible
- [ ] Login functionality works
- [ ] API integration confirmed
- [ ] Environment variables correct
- [ ] No console errors
- [ ] Performance acceptable (< 3s load time)
- [ ] Mobile responsive verified

## Local Testing Before Deployment

Test the staging build locally before triggering deployment:

```bash
cd phase3a-portal

# Build with staging configuration
npm run build:staging

# Preview the build
npm run preview

# Access at http://localhost:4173
# Verify all features work with staging API
```

## Related Documentation

- [.github/workflows/deploy-phase3a-staging.yml](../.github/workflows/deploy-phase3a-staging.yml) - Workflow definition
- [STAGING_DEPLOYMENT.md](STAGING_DEPLOYMENT.md) - Detailed deployment guide
- [README.md](README.md) - Portal overview and quick start
- [.env.staging](.env.staging) - Staging environment variables

## Support

For deployment issues:
- Check workflow logs in GitHub Actions
- Review CloudWatch logs for S3/CloudFront
- Contact DevOps team for infrastructure issues
- See TROUBLESHOOTING section in STAGING_DEPLOYMENT.md

---

**Last Updated:** January 30, 2026  
**Status:** Ready for Staging Deployment  
**Workflow:** `.github/workflows/deploy-phase3a-staging.yml`
