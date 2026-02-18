# GitHub Pages Deployment for Phase 3A Demo

## Overview

The Phase 3A Demo deployment has been updated to use **GitHub Pages** instead of AWS S3. This change eliminates the need for AWS credentials since the demo uses entirely mock/static data (VITE_USE_MOCK_API=true).

## Changes Made

### 1. Updated Deploy Job (`deploy-demo`)

**Removed:**
- AWS credentials configuration (`aws-actions/configure-aws-credentials@v4`)
- S3 bucket creation and management
- S3 static website hosting configuration
- S3 bucket policy setup
- S3 file sync operations

**Added:**
- GitHub Pages permissions:
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write
  ```
- GitHub Pages deployment actions:
  - `actions/configure-pages@v4` - Configures GitHub Pages
  - `actions/upload-pages-artifact@v3` - Uploads build artifacts
  - `actions/deploy-pages@v4` - Deploys to GitHub Pages
- Job output to share deployment URL with validation and notification jobs

**Result:**
- Reduced from ~96 lines to ~33 lines
- No AWS credentials required
- Automatic GitHub token authentication

### 2. Updated Validation Job (`validate-demo`)

- Replaced hardcoded S3 URL construction with dynamic GitHub Pages URL
- Uses `${{ needs.deploy-demo.outputs.page_url }}` to get the deployment URL
- All validation checks (HTTP status, index.html, demo-data.json) now use GitHub Pages URL

### 3. Updated Notification Job (`notify`)

- Updated success message to mention "GitHub Pages"
- Uses deployment URL from `deploy-demo` job output

## Deployment URL

After deployment, the demo will be accessible at:
```
https://securebase.tximhotep.com 
```

## Prerequisites

### GitHub Pages Configuration

GitHub Pages needs to be enabled for the repository with the following settings:

1. **Repository Settings → Pages:**
   - Source: **GitHub Actions** (not "Deploy from a branch")
   - This allows the workflow to deploy directly using actions

2. **Repository Settings → Actions:**
   - Ensure workflow permissions include:
     - Read repository contents
     - Read and write to GitHub Pages

### How to Enable GitHub Pages

1. Go to repository settings: https://github.com/cedrickbyrd/securebase-app/settings
2. Navigate to "Pages" in the left sidebar
3. Under "Build and deployment":
   - Set **Source** to: `GitHub Actions`
4. Save the settings

## Testing the Deployment

### Manual Workflow Trigger

1. Go to: https://github.com/cedrickbyrd/securebase-app/actions/workflows/deploy-phase3a-demo.yml
2. Click "Run workflow"
3. Select branch: `main` or `copilot/fix-deploy-to-github-pages`
4. Click "Run workflow" button

### Expected Workflow Steps

1. **build-demo** - Builds the portal with mock data
   - Installs dependencies
   - Runs linter
   - Builds with demo environment variables
   - Uploads build artifacts

2. **deploy-demo** - Deploys to GitHub Pages
   - Downloads build artifacts
   - Configures GitHub Pages
   - Uploads to GitHub Pages
   - Deploys and outputs URL

3. **validate-demo** - Validates deployment
   - Waits 30 seconds for propagation
   - Checks HTTP status code (expects 200)
   - Validates index.html contains "SecureBase"
   - Checks demo-data.json accessibility

4. **notify** - Sends notification
   - Displays deployment URL
   - Shows sharing instructions

### Verification Checklist

After deployment completes:

- [ ] Workflow runs without AWS credential errors
- [ ] All jobs complete successfully (green checkmarks)
- [ ] Deployment URL is displayed in the notify job
- [ ] Site is accessible at `https://securebase.tximhotep.com/`
- [ ] Demo banner is visible on the site
- [ ] Login works with demo credentials (demo/demo)
- [ ] All pages load with mock data
- [ ] No console errors related to API calls
- [ ] Read-only mode is enforced (no data modifications)

## Troubleshooting

### Error: "Resource not accessible by integration"

**Cause:** GitHub Pages is not enabled or workflow doesn't have proper permissions

**Solution:**
1. Enable GitHub Pages in repository settings (Source: GitHub Actions)
2. Check workflow permissions in repository settings → Actions → General
3. Ensure "Read and write permissions" is enabled

### Error: "Not Found" when accessing deployment URL

**Cause:** First deployment may take a few minutes to propagate

**Solution:**
1. Wait 2-5 minutes after successful deployment
2. Try accessing the URL again
3. Check the Actions tab for deployment status
4. Verify the deployment job completed successfully

### Validation job fails with HTTP 404

**Cause:** URL might not be propagated yet or incorrect path

**Solution:**
1. The workflow waits 30 seconds before validation - may need to increase
2. Check the deploy-demo job output for the actual deployment URL
3. Manually test the URL in a browser

## Comparison with Staging Deployment

| Aspect | Demo (GitHub Pages) | Staging (S3) |
|--------|-------------------|--------------|
| **Backend** | Mock data only | Real backend API |
| **Credentials** | None required | AWS credentials needed |
| **Cost** | Free | AWS S3 + data transfer |
| **URL** | tximhotep.com subdomain | S3 website endpoint |
| **Use Case** | Sales demos, public preview | Pre-production testing |
| **Data** | Read-only, resets every 24h | Live staging data |

## Benefits

✅ **No AWS Credentials Required** - Uses automatic GitHub token authentication
✅ **Cost Savings** - GitHub Pages is free for public repositories  
✅ **Simplified Workflow** - Fewer steps, easier to maintain
✅ **Perfect for Static Sites** - Demo uses only client-side mock data
✅ **Stable URL** - Persistent tximhotep.com URL for sharing
✅ **Fast Deployment** - Direct GitHub Actions integration

## Demo Environment Variables

The demo build uses these environment variables (already configured in the workflow):

```yaml
VITE_DEMO_MODE: true
VITE_READ_ONLY_MODE: true
VITE_SHOW_DEMO_BANNER: true
VITE_AUTO_RESET_ENABLED: true
VITE_RESET_INTERVAL_HOURS: 24
VITE_USE_MOCK_API: true
```

These ensure the demo:
- Shows a demo banner
- Operates in read-only mode
- Uses mock API data
- Auto-resets every 24 hours
- Displays CTAs for trial signup and demo booking

## Next Steps

1. **Merge this PR** to apply the changes
2. **Enable GitHub Pages** in repository settings (if not already enabled)
3. **Trigger the workflow** manually or push to main
4. **Verify deployment** at https://securebase.tximhotep.com/
5. **Share the URL** with stakeholders for testing

## Additional Notes

- The staging deployment (`.github/workflows/deploy-phase3a-staging.yml`) continues to use S3 as it connects to real backend services
- Only the demo deployment uses GitHub Pages since it's entirely self-contained with mock data
- No repository secrets or configuration changes are needed
- GitHub automatically handles SSL/TLS certificates for tximhotep.com domains
