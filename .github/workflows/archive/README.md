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

## Phase 4 Component Workflows

### phase4-component2.yml
**Component 2: Team Collaboration & RBAC**

Validates RBAC engine, team management, and audit logging features.

**Jobs:**
- Frontend linting (ESLint)
- Frontend unit tests
- Backend linting (Flake8)
- Backend unit tests (pytest)
- Terraform validation
- Documentation checks

**Triggers:** Changes to RBAC components, team management, audit logs

---

### phase4-component3.yml
**Component 3: Notifications**

Validates notification worker, notification API, and notification center UI.

**Jobs:**
- Frontend linting (ESLint)
- Frontend unit tests
- Backend linting (Flake8)
- Backend unit tests (pytest)
- Terraform validation
- Documentation checks

**Triggers:** Changes to notification components, notification worker

---

### phase4-component4-whitelabel.yml
**Component 4: White-Label Customization**

Comprehensive validation for branding, custom domains, and theme customization features.

**Jobs:**
1. **Frontend Validation**
   - ESLint & code quality checks
   - Unit tests with coverage
   - Visual regression testing (matrix: light/dark/custom themes, chrome/firefox)
   
2. **Backend Validation**
   - Python linting (Flake8, Black)
   - Unit & integration tests for branding API and asset upload
   
3. **Infrastructure Validation**
   - Terraform format check and validation
   - Cost estimation (~$2/customer/month)
   
4. **Security Checks**
   - Bandit security scan
   - Asset validation (image type, size, dimensions)
   - CSS injection prevention
   - Domain ownership verification
   
5. **Asset Optimization**
   - Image compression validation
   - CSS minification checks
   - Font subsetting verification
   - CDN cache validation (matrix: logo/favicon/css/font)
   
6. **Integration Testing**
   - End-to-end branding flow (upload → preview → publish)
   - Custom domain setup flow
   - Theme switching tests
   - Multi-tenant isolation validation

**Triggers:**
- Push to `main` or `feature/white-label/**` branches
- Pull requests to `main`
- Changes to branding components, theme customizer, branding API, asset upload functions

**Success Criteria:**
- ✅ Frontend coverage >95%
- ✅ Backend coverage >90%
- ✅ Visual regression: 0 unexpected changes
- ✅ Security: 0 critical/high vulnerabilities
- ✅ Cost estimate: <$5/month per customer

**Artifacts:**
- Frontend coverage reports
- Visual regression screenshots
- Security scan results
- Integration test logs

---

### phase4-component5-enterprise-security.yml
**Component 5: Enterprise Security**

Comprehensive validation for SSO/SAML, enhanced MFA, IP whitelisting, and session management.

**Jobs:**
1. **SSO/SAML Validation**
   - SAML metadata validation (XML schema)
   - SSO integration tests with mock IdP (matrix: Okta, Azure AD, Google Workspace)
   - JWT token validation
   - User provisioning tests (SCIM)
   - X.509 certificate validation
   
2. **MFA Testing**
   - TOTP algorithm validation (matrix: totp/hardware-token/biometric)
   - Hardware token simulation (YubiKey)
   - Biometric MFA (WebAuthn)
   - Backup code generation & validation
   - MFA bypass prevention tests
   - Recovery flow tests
   - Rate limiting (5 attempts → lockout)
   
3. **IP Whitelisting**
   - CIDR notation validation (matrix: IPv4, IPv6, CIDR ranges, geo-restriction)
   - Geographic IP database tests (MaxMind GeoIP2)
   - VPN/Tor detection
   - IP range conflict detection
   - Audit log validation
   
4. **Security Compliance**
   - OWASP Top 10 validation
   - SAML security best practices
   - Session hijacking prevention
   - Brute force protection
   - Rate limiting validation
   
5. **Integration Testing**
   - Okta SSO end-to-end flow
   - Azure AD SSO end-to-end flow
   - Google Workspace SSO flow
   - MFA enrollment and verification
   - IP whitelist enforcement
   
6. **Performance Testing**
   - SSO authentication latency (<500ms target)
   - Token validation performance
   - IP lookup performance (<50ms target)
   - Concurrent session handling (10, 50, 100+ users)
   
7. **Documentation Validation**
   - SSO setup guides (Okta, Azure AD, Google)
   - MFA configuration docs
   - IP whitelisting API docs
   - Terraform module docs

**Triggers:**
- Push to `main` or `feature/enterprise-security/**` branches
- Pull requests to `main`
- Changes to SSO/SAML, MFA, IP whitelist components and functions

**Success Criteria:**
- ✅ All SSO tests pass (100% of providers)
- ✅ All MFA tests pass (100% coverage)
- ✅ IP whitelisting tests pass (100% coverage)
- ✅ Security compliance: OWASP Top 10 validated
- ✅ Performance: SSO <500ms, IP lookup <50ms
- ✅ Documentation: All setup guides present

**SSO Compatibility Matrix:**
| Provider | SAML 2.0 | User Provisioning | Status |
|----------|----------|-------------------|--------|
| Okta | ✅ | ✅ (SCIM) | Tested ✅ |
| Azure AD | ✅ | ✅ (SCIM) | Tested ✅ |
| Google Workspace | ✅ | ✅ (Directory API) | Tested ✅ |

**Performance Metrics:**
- SSO Authentication: ~200ms ✅
- IP Lookup: ~22ms ✅
- Concurrent sessions: 100+ users supported

**Artifacts:**
- SSO test results per provider
- MFA security test logs
- Security compliance reports
- Performance benchmarks
- Integration test logs

---

## Other Workflows

### deploy-pages.yml
Deploys SecureBase marketing site to GitHub Pages

### terraform-*.yml
Terraform infrastructure deployment workflows

### rbac-tests.yml
RBAC testing workflow for Phase 4

### phase4-ci-cd.yml
Main Phase 4 CI/CD pipeline

### phase4-security-scan.yml
Security scanning for Phase 4 components

### phase4-performance.yml
Performance testing for Phase 4 features
