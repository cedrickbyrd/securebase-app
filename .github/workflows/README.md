# GitHub Actions Workflows

This directory contains GitHub Actions workflows for SecureBase automation.

## Phase 3a Staging Deployment

**File:** `deploy-phase3a-staging.yml`

### Overview

Automates the deployment of Phase 3a Customer Portal to AWS S3 staging environment.

### Triggers

The workflow can be triggered in three ways:

1. **Automatic on Push**: Triggers when code is pushed to the `staging` branch
   - Only deploys if changes are in `phase3a-portal/**` directory
   
2. **Pull Request**: Triggers on PR to `staging` branch
   - Builds and validates but does NOT deploy
   - Only runs if changes are in `phase3a-portal/**` directory
   
3. **Manual Dispatch**: Can be triggered manually from GitHub Actions UI

### Workflow Jobs

#### 1. Build Portal
- Checks out code
- Sets up Node.js 18.x
- Installs dependencies with `npm ci`
- Runs linter (warnings allowed)
- Builds staging bundle
- Uploads build artifacts for deployment

#### 2. Deploy to S3
- Only runs on push or manual dispatch (not PRs)
- Downloads build artifacts
- Configures AWS credentials
- Creates S3 bucket if it doesn't exist
- Configures static website hosting
- Sets bucket policy for public access
- Syncs files to S3 with appropriate cache headers
- Outputs staging URL

#### 3. Validate Deployment
- Waits 30 seconds for S3 propagation
- Performs smoke test (HTTP 200 check)
- Validates index.html contains expected content

#### 4. Notify
- Sends deployment notification
- Reports success or failure
- Displays staging URL

### Required GitHub Secrets

Add these secrets in repository Settings → Secrets and variables → Actions:

```
AWS_ACCESS_KEY_ID          - AWS access key for deployment
AWS_SECRET_ACCESS_KEY      - AWS secret access key
AWS_REGION                 - Target AWS region (default: us-east-1)
STAGING_S3_BUCKET          - S3 bucket name (default: securebase-phase3a-staging)
STAGING_API_URL            - API endpoint for staging (optional)
STAGING_WS_URL             - WebSocket URL for staging (optional)
STAGING_STRIPE_PUBLIC_KEY  - Stripe public key for staging (optional)
```

### Manual Deployment Instructions

1. Navigate to the GitHub repository
2. Click on the "Actions" tab
3. Select "Deploy Phase 3a to Staging" workflow from the left sidebar
4. Click "Run workflow" button (top right)
5. Select branch: `staging`
6. Select environment: `staging`
7. Click "Run workflow" to start deployment

### Monitoring Deployment

- **View Logs**: Click on the running workflow to see detailed logs
- **Check Status**: Each job shows success/failure status
- **Staging URL**: Displayed in the deploy job output
- **Validation**: Validate job confirms site is accessible

### Default Values

If secrets are not configured, the workflow uses these defaults:

- **AWS Region**: us-east-1
- **S3 Bucket**: securebase-phase3a-staging
- **API URL**: https://staging-api.securebase.com/v1
- **WebSocket URL**: wss://staging-ws.securebase.com
- **Stripe Key**: pk_test_YOUR_TEST_KEY_HERE

### Deployment URL

After successful deployment, the portal is accessible at:
```
http://securebase-phase3a-staging.s3-website-us-east-1.amazonaws.com
```

(Replace region if using a different AWS region)

### Troubleshooting

**Build Fails:**
- Check Node.js version is 18.x
- Verify package-lock.json is up to date
- Check for linting errors in phase3a-portal/src

**Deployment Fails:**
- Verify AWS credentials are valid
- Check IAM permissions for S3 operations
- Ensure S3 bucket name is globally unique

**Validation Fails:**
- Check S3 bucket policy allows public read
- Verify static website hosting is enabled
- Check for deployment timing issues (may need more propagation time)

**Secret Not Found:**
- Verify secrets are set in repository settings
- Check secret names match exactly (case-sensitive)
- Ensure you're running from correct branch

## Other Workflows

### deploy-pages.yml
Deploys SecureBase marketing site to GitHub Pages

### terraform-*.yml
Terraform infrastructure deployment workflows

### rbac-tests.yml
RBAC testing workflow for Phase 4

### phase4-component*.yml
Phase 4 component deployment workflows
