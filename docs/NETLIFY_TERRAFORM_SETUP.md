# Netlify Terraform Setup Guide

## Overview
This guide walks you through setting up Terraform management for SecureBase's Netlify deployments, including the marketing site (securebase.io) and customer portal demo (portal-demo.securebase.io).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Storing Netlify Token Securely](#storing-netlify-token-securely)
4. [Deploying New Sites](#deploying-new-sites)
5. [Importing Existing Sites](#importing-existing-sites)
6. [DNS Configuration](#dns-configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Topics](#advanced-topics)

---

## Prerequisites

### Required Accounts and Access
- ✅ **Netlify Account**: Sign up at https://app.netlify.com (free tier is sufficient)
- ✅ **GitHub Access**: Repository access for cedrickbyrd/securebase-app
- ✅ **AWS Account**: For storing Netlify token in Secrets Manager (optional but recommended)
- ✅ **DNS Access**: Ability to modify DNS records for custom domains
- ✅ **Terraform**: Version 1.0+ installed locally

### Required Tools
```bash
# Verify Terraform installation
terraform version  # Should be 1.0+

# Verify AWS CLI (if using Secrets Manager)
aws --version

# Optional: Netlify CLI for local testing
npm install -g netlify-cli
netlify --version
```

---

## Initial Setup

### Step 1: Generate Netlify API Token

1. **Log into Netlify**: https://app.netlify.com
2. **Navigate to User Settings**:
   - Click your avatar (top right)
   - Select "User settings"
3. **Create Personal Access Token**:
   - Go to "Applications" tab
   - Scroll to "Personal Access Tokens"
   - Click "New access token"
   - Enter description: `"Terraform SecureBase (Created YYYY-MM-DD)"`
   - Click "Generate token"
4. **Copy Token Immediately**:
   - ⚠️ **Important**: You won't be able to see it again
   - Copy to secure location temporarily

### Step 2: Connect Netlify to GitHub

If you haven't already connected Netlify to GitHub:

1. Go to https://app.netlify.com/user/applications
2. Under "GitHub", click "Connect"
3. Authorize Netlify for your GitHub account
4. Grant access to `cedrickbyrd/securebase-app` repository

### Step 3: Prepare Terraform Environment

Navigate to the Terraform environment directory:
```bash
cd landing-zone/environments/dev
```

Verify required files exist:
```bash
ls -la
# Should show: main.tf, variables.tf, outputs.tf, terraform.tfvars
```

---

## Storing Netlify Token Securely

### Option 1: AWS Secrets Manager (Recommended for Production)

**Best for**: Production deployments, team collaboration, CI/CD pipelines

#### Create Secret in AWS Secrets Manager
```bash
# Create secret
aws secretsmanager create-secret \
  --name netlify-api-token \
  --description "Netlify API token for Terraform" \
  --secret-string "your-actual-netlify-token-here" \
  --region us-east-1 \
  --tags Key=Project,Value=SecureBase Key=ManagedBy,Value=Terraform

# Verify secret was created
aws secretsmanager describe-secret \
  --secret-id netlify-api-token \
  --region us-east-1
```

#### Retrieve in Terraform
Add to your Terraform configuration:

```hcl
# In landing-zone/environments/dev/main.tf

data "aws_secretsmanager_secret" "netlify_token" {
  name = "netlify-api-token"
}

data "aws_secretsmanager_secret_version" "netlify_token" {
  secret_id = data.aws_secretsmanager_secret.netlify_token.id
}

locals {
  netlify_token = data.aws_secretsmanager_secret_version.netlify_token.secret_string
}

provider "netlify" {
  token = local.netlify_token
}

module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token = local.netlify_token
  # ... other variables
}
```

#### IAM Permissions Required
Ensure your Terraform execution role has:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:netlify-api-token-*"
    }
  ]
}
```

### Option 2: Environment Variable (Recommended for Development)

**Best for**: Local development, testing, quick iterations

```bash
# Set environment variable (Linux/macOS)
export TF_VAR_netlify_token="your-actual-netlify-token-here"

# Verify it's set
echo $TF_VAR_netlify_token

# Make it persistent (add to ~/.bashrc or ~/.zshrc)
echo 'export TF_VAR_netlify_token="your-actual-netlify-token-here"' >> ~/.bashrc
source ~/.bashrc
```

Windows (PowerShell):
```powershell
$env:TF_VAR_netlify_token="your-actual-netlify-token-here"

# Make it persistent
[Environment]::SetEnvironmentVariable("TF_VAR_netlify_token", "your-actual-netlify-token-here", "User")
```

Terraform will automatically use `TF_VAR_*` environment variables.

### Option 3: Terraform Variables File (Not Recommended)

**⚠️ Security Risk**: Only use for local testing, never commit to Git

```hcl
# terraform.tfvars (ADD TO .gitignore!)
netlify_token = "your-actual-netlify-token-here"
```

**Critical**: Add to `.gitignore`:
```bash
# Add to .gitignore
echo "terraform.tfvars" >> .gitignore
echo "*.tfvars" >> .gitignore
echo "!*.tfvars.example" >> .gitignore
```

### Security Best Practices

1. **Never commit tokens to Git**
2. **Rotate tokens every 90 days**
3. **Use read-only tokens when possible** (Netlify tokens have full access)
4. **Audit token usage** via Netlify dashboard → Settings → Audit log
5. **Revoke old tokens** after rotation

---

## Deploying New Sites

### Step 1: Initialize Terraform

```bash
cd landing-zone/environments/dev

# Initialize Terraform (downloads Netlify provider)
terraform init

# You should see:
# - Downloading netlify/netlify provider
# - Terraform initialized successfully
```

### Step 2: Review Configuration

```bash
# View planned changes
terraform plan -target=module.netlify_sites

# Expected output:
# + netlify_site.marketing
# + netlify_site.portal_demo
# + netlify_build_settings.marketing
# + netlify_build_settings.portal_demo
# + netlify_site_domain.marketing
# + netlify_site_domain.portal_demo
# + netlify_build_hook.marketing_manual
# + netlify_build_hook.portal_demo_manual
# + netlify_deploy_key.marketing
# + netlify_deploy_key.portal_demo
```

### Step 3: Deploy Sites

```bash
# Apply configuration
terraform apply -target=module.netlify_sites

# Review changes, type 'yes' when prompted
```

### Step 4: View Outputs

```bash
# View all Netlify outputs
terraform output | grep netlify

# Specific outputs
terraform output netlify_marketing_site_url
terraform output netlify_portal_demo_url
terraform output netlify_deployment_summary
```

Expected output:
```
netlify_marketing_site_url = "securebase-app.netlify.app"
netlify_portal_demo_url = "securebase-demo.netlify.app"
netlify_deployment_summary = {
  marketing_site = {
    custom_domain = "securebase.io"
    netlify_url = "https://securebase-app.netlify.app"
    site_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
  portal_demo = {
    custom_domain = "portal-demo.securebase.io"
    netlify_url = "https://securebase-demo.netlify.app"
    site_id = "f9e8d7c6-b5a4-3210-9876-543210fedcba"
  }
}
```

---

## Importing Existing Sites

### Importing Existing SecureBase Sites (Quick Method)

The SecureBase project has two existing Netlify sites that need to be imported into Terraform:
1. **Marketing Site**: `securebase-app.netlify.app`
2. **Demo Portal**: `securebase-demo.netlify.app`

**Automated Import Script:**

```bash
./scripts/import-netlify-sites.sh
```

This script will:
- ✅ Check prerequisites (Terraform, Netlify CLI, API token)
- ✅ Prompt for site IDs from Netlify Dashboard
- ✅ Import environment variable resources
- ✅ Verify the import with `terraform plan`

For manual import steps, see the [module README](../landing-zone/modules/netlify-sites/README.md#importing-existing-securebase-sites).

### General Netlify Sites Import

If you have other Netlify sites deployed manually, import them into Terraform state:

### Step 1: Get Site IDs

**Option 1: Netlify Dashboard**
1. Go to https://app.netlify.com/sites
2. Click on your site
3. Go to "Site settings" → "General"
4. Copy the "API ID" or "Site ID"

**Option 2: Netlify CLI**
```bash
netlify sites:list

# Output:
# ┌─────────────────────────┬──────────────────────────────────────┬─────────────────────────┐
# │ Site Name               │ Site ID                              │ URL                     │
# ├─────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
# │ securebase-app          │ a1b2c3d4-e5f6-7890-abcd-ef1234567890 │ securebase-app.netlif…  │
# │ securebase-demo         │ f9e8d7c6-b5a4-3210-9876-543210fedcba │ securebase-demo.netlif… │
# └─────────────────────────┴──────────────────────────────────────┴─────────────────────────┘
```

### Step 2: Import Site Resources

```bash
cd landing-zone/environments/dev

# Import marketing site
terraform import 'module.netlify_sites.netlify_site.marketing' a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Import portal demo site
terraform import 'module.netlify_sites.netlify_site.portal_demo' f9e8d7c6-b5a4-3210-9876-543210fedcba
```

### Step 3: Import Build Settings

```bash
# Import marketing build settings
terraform import 'module.netlify_sites.netlify_build_settings.marketing' a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Import portal demo build settings
terraform import 'module.netlify_sites.netlify_build_settings.portal_demo' f9e8d7c6-b5a4-3210-9876-543210fedcba
```

### Step 4: Import Custom Domains

```bash
# Import marketing custom domain
terraform import 'module.netlify_sites.netlify_site_domain.marketing' a1b2c3d4-e5f6-7890-abcd-ef1234567890:securebase.io

# Import portal demo custom domain
terraform import 'module.netlify_sites.netlify_site_domain.portal_demo' f9e8d7c6-b5a4-3210-9876-543210fedcba:portal-demo.securebase.io
```

### Step 5: Verify Import

```bash
# Run plan - should show minimal or no changes
terraform plan -target=module.netlify_sites

# If configuration matches, you should see:
# "No changes. Your infrastructure matches the configuration."
```

### Troubleshooting Import

**Issue**: Plan shows many changes after import  
**Cause**: Terraform configuration doesn't match existing site settings  
**Solution**: 
1. Check Netlify dashboard for actual settings
2. Update module configuration to match
3. Re-run `terraform plan`

**Issue**: Import fails with "resource not found"  
**Cause**: Site ID is incorrect  
**Solution**: 
1. Double-check Site ID from Netlify dashboard
2. Ensure you're importing to correct resource name
3. Verify Netlify token has access to the site

---

## DNS Configuration

After deploying sites (new or imported), configure DNS for custom domains.

### Marketing Site: securebase.io

#### Check Required DNS Records

1. Go to Netlify site settings: https://app.netlify.com/sites/[site-name]/settings/domain
2. Click on your custom domain `securebase.io`
3. Note the DNS records shown (usually an ALIAS or A record)

#### Configure DNS (Route 53 Example)

```bash
# Using AWS CLI
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "securebase.io",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "75.2.60.5"}]
      }
    }]
  }'
```

#### Using Terraform (Route 53)

```hcl
# Add to your terraform configuration
data "aws_route53_zone" "main" {
  name = "securebase.io"
}

resource "aws_route53_record" "marketing" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "securebase.io"
  type    = "A"
  ttl     = 300
  records = ["75.2.60.5"]  # Netlify load balancer IP
}
```

#### Manual DNS Configuration

If using another DNS provider (Cloudflare, Namecheap, GoDaddy):

1. Log into your DNS provider
2. Find DNS settings for `securebase.io`
3. Add A record:
   - **Type**: A
   - **Name**: @ (or leave blank for root domain)
   - **Value**: 75.2.60.5
   - **TTL**: 300 (or Auto)

### Portal Demo: portal-demo.securebase.io

#### Route 53 Example

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "portal-demo.securebase.io",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "securebase-demo.netlify.app"}]
      }
    }]
  }'
```

#### Using Terraform (Route 53)

```hcl
resource "aws_route53_record" "portal_demo" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "portal-demo.securebase.io"
  type    = "CNAME"
  ttl     = 300
  records = [module.netlify_sites.portal_demo_url]
}
```

#### Manual DNS Configuration

1. Log into DNS provider
2. Add CNAME record:
   - **Type**: CNAME
   - **Name**: portal-demo
   - **Value**: [your-netlify-url].netlify.app (from terraform output)
   - **TTL**: 300

### DNS Propagation

DNS changes can take time to propagate:
- **Minimum**: 5-15 minutes
- **Average**: 1-4 hours
- **Maximum**: 24-48 hours

---

## Verification

### Step 1: Check DNS Propagation

```bash
# Check marketing site DNS
dig securebase.io
# Should show A record pointing to 75.2.60.5

# Check portal demo DNS
dig portal-demo.securebase.io
# Should show CNAME record pointing to Netlify URL
```

Online tools:
- https://www.whatsmydns.net/
- https://dnschecker.org/

### Step 2: Test HTTPS Certificates

```bash
# Marketing site
curl -I https://securebase.io

# Should return:
# HTTP/2 200
# And no SSL errors

# Portal demo
curl -I https://portal-demo.securebase.io

# Should return:
# HTTP/2 200
# And no SSL errors
```

**Note**: Netlify automatically provisions Let's Encrypt SSL certificates after DNS verification (can take 5-30 minutes).

### Step 3: Verify Site Content

```bash
# Check marketing site loads
curl -s https://securebase.io | grep -i "<title>"

# Check portal demo loads
curl -s https://portal-demo.securebase.io | grep -i "<title>"
```

### Step 4: Check Netlify Dashboard

1. Go to https://app.netlify.com/sites
2. Click on each site
3. Verify:
   - ✅ Last deploy succeeded
   - ✅ Custom domain shows "Netlify DNS" or "External DNS" with green checkmark
   - ✅ HTTPS certificate is active
   - ✅ Environment variables are set correctly

### Step 5: Test Deployments

```bash
# Make a small change to trigger deploy
echo "# Test commit" >> README.md
git add README.md
git commit -m "test: Verify Netlify auto-deploy"
git push origin main

# Watch builds in Netlify dashboard
# Both sites should rebuild automatically within 1-2 minutes
```

---

## Troubleshooting

### Issue 1: Invalid Netlify API Token

**Symptoms**:
```
Error: invalid Netlify API token
```

**Solutions**:
1. Verify token is set correctly:
   ```bash
   echo $TF_VAR_netlify_token
   # Should output your token
   ```

2. Generate new token:
   - Go to https://app.netlify.com/user/applications
   - Revoke old token
   - Create new token
   - Update environment variable or Secrets Manager

3. Check token permissions:
   - Netlify dashboard → User settings → Applications
   - Ensure token has access to required sites

### Issue 2: Site Name Already Exists

**Symptoms**:
```
Error: site with name "securebase-app" already exists
```

**Solutions**:
1. Import existing site (see "Importing Existing Sites" section)
2. Or rename site in module configuration:
   ```hcl
   # In modules/netlify-sites/main.tf
   data "netlify_site" "marketing" {
     name = "securebase-app-v2"  # Change name
   }
   ```

### Issue 3: GitHub Repository Access Denied

**Symptoms**:
```
Error: failed to connect to GitHub repository
```

**Solutions**:
1. Connect Netlify to GitHub:
   - https://app.netlify.com/user/applications
   - Click "Connect" under GitHub
   - Authorize repository access

2. Check repository settings:
   - Ensure repository is public or Netlify has access
   - Verify `cedrickbyrd/securebase-app` exists

3. Regenerate deploy key:
   ```bash
   terraform taint 'module.netlify_sites.netlify_deploy_key.marketing'
   terraform apply
   ```

### Issue 4: Custom Domain Not Verified

**Symptoms**:
- Netlify dashboard shows "Awaiting External DNS" or "DNS not configured"
- Site loads on `.netlify.app` but not custom domain

**Solutions**:
1. Verify DNS records:
   ```bash
   dig securebase.io
   dig portal-demo.securebase.io
   ```

2. Check TTL and wait for propagation (use https://www.whatsmydns.net/)

3. Force DNS check in Netlify:
   - Dashboard → Site settings → Domain management
   - Click "Verify DNS configuration"

4. Clear DNS cache locally:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Linux
   sudo systemd-resolve --flush-caches
   
   # Windows
   ipconfig /flushdns
   ```

### Issue 5: Build Fails

**Symptoms**:
- Netlify dashboard shows failed deploy
- Build logs show errors

**Solutions**:
1. Check build logs in Netlify dashboard

2. Verify build command is correct:
   ```hcl
   # Should match package.json scripts
   build_command = "npm run build"
   ```

3. Check environment variables:
   ```bash
   # View in Netlify dashboard
   # Settings → Environment variables
   
   # Or via Terraform output
   terraform show | grep -A 10 netlify_build_settings
   ```

4. Test build locally:
   ```bash
   # Marketing site
   npm install
   npm run build
   
   # Portal demo
   cd phase3a-portal
   npm install
   npm run build
   ```

5. Check Node version compatibility:
   ```hcl
   environment = {
     NODE_VERSION = "22"  # Ensure this matches your local version
   }
   ```

### Issue 6: Terraform State Conflicts

**Symptoms**:
```
Error: resource already exists in state
```

**Solutions**:
1. Remove from state and re-import:
   ```bash
   terraform state rm 'module.netlify_sites.netlify_site.marketing'
   terraform import 'module.netlify_sites.netlify_site.marketing' <site-id>
   ```

2. Or destroy and recreate (⚠️ causes downtime):
   ```bash
   terraform destroy -target=module.netlify_sites
   terraform apply -target=module.netlify_sites
   ```

---

## Advanced Topics

### Using Build Hooks for Manual Deployments

Retrieve build hook URLs:
```bash
# Get build hook (sensitive output)
terraform output -json | jq -r '.netlify_sites_marketing_build_hook_url.value'
terraform output -json | jq -r '.netlify_sites_portal_demo_build_hook_url.value'
```

Trigger manual deploy:
```bash
# Trigger marketing site rebuild
curl -X POST [build-hook-url]

# Trigger portal demo rebuild
curl -X POST [build-hook-url]
```

Use in CI/CD:
```yaml
# .github/workflows/deploy.yml
- name: Trigger Netlify Deploy
  run: |
    curl -X POST ${{ secrets.NETLIFY_BUILD_HOOK_MARKETING }}
```

### Managing Multiple Environments

Create separate modules for different environments:

```hcl
# dev environment
module "netlify_sites_dev" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "dev.securebase.io"
  portal_demo_domain  = "portal-dev.securebase.io"
}

# staging environment
module "netlify_sites_staging" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "staging.securebase.io"
  portal_demo_domain  = "portal-staging.securebase.io"
}

# production environment
module "netlify_sites_prod" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal.securebase.io"
}
```

### Automating DNS with Route 53

Full automation example:

```hcl
# Data source for existing hosted zone
data "aws_route53_zone" "main" {
  name = "securebase.io"
}

# Marketing site A record
resource "aws_route53_record" "marketing" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "securebase.io"
  type    = "A"
  ttl     = 300
  records = ["75.2.60.5"]  # Netlify IP
}

# Portal demo CNAME
resource "aws_route53_record" "portal_demo" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "portal-demo.securebase.io"
  type    = "CNAME"
  ttl     = 300
  records = [module.netlify_sites.portal_demo_url]
}

# Outputs
output "dns_nameservers" {
  value = data.aws_route53_zone.main.name_servers
}
```

### Monitoring and Alerting

Set up monitoring for Netlify deployments:

1. **Netlify Notifications**:
   - Dashboard → Site settings → Build & deploy → Deploy notifications
   - Add email, Slack, or webhook notifications

2. **CloudWatch Alarms** (for custom domains):
   ```hcl
   resource "aws_cloudwatch_metric_alarm" "marketing_site_down" {
     alarm_name          = "securebase-marketing-site-down"
     comparison_operator = "LessThanThreshold"
     evaluation_periods  = 2
     metric_name         = "HealthCheckStatus"
     namespace           = "AWS/Route53"
     period              = 60
     statistic           = "Minimum"
     threshold           = 1
     alarm_description   = "Marketing site is down"
     alarm_actions       = [aws_sns_topic.alerts.arn]
   }
   ```

3. **Uptime Monitoring** (external services):
   - https://uptimerobot.com/
   - https://www.pingdom.com/
   - Set up checks for https://securebase.io and https://portal-demo.securebase.io

### Backup and Disaster Recovery

Netlify automatically:
- ✅ Keeps all historical deploys
- ✅ Allows instant rollback to any previous deploy
- ✅ Stores site configuration in Terraform state

Manual backup of Netlify configuration:
```bash
# Export Terraform state
terraform state pull > netlify-state-backup-$(date +%Y%m%d).json

# Export site configuration via API
curl -H "Authorization: Bearer $NETLIFY_TOKEN" \
  https://api.netlify.com/api/v1/sites/$SITE_ID > site-config-backup.json
```

Rollback procedure:
1. **Via Netlify Dashboard**: 
   - Deploys → Select previous deploy → "Publish deploy"

2. **Via Terraform**: 
   - Revert code changes
   - Push to GitHub
   - Netlify auto-deploys previous version

3. **Emergency Rollback**: 
   ```bash
   # Restore from Terraform state backup
   terraform state push netlify-state-backup-20260207.json
   terraform apply
   ```

---

## Summary Checklist

After completing this guide, verify:

- [ ] Netlify API token generated and stored securely
- [ ] Netlify connected to GitHub repository
- [ ] Terraform module deployed successfully
- [ ] DNS records configured for custom domains
- [ ] HTTPS certificates active on both sites
- [ ] Test deployments work (push to main triggers rebuild)
- [ ] Build hooks created for manual deployments
- [ ] Monitoring and alerts configured
- [ ] Backup procedures documented
- [ ] Team members have access to Netlify dashboard

---

## Next Steps

1. **Set up branch deploys**: Configure Netlify to create preview deployments for pull requests
2. **Add redirects**: Configure URL redirects in `netlify.toml`
3. **Custom headers**: Add security headers (CSP, HSTS) in `netlify.toml`
4. **Analytics**: Set up Netlify Analytics or integrate Google Analytics
5. **Performance**: Enable HTTP/2, compression, and asset optimization
6. **Forms**: Add Netlify Forms for contact forms (if needed)
7. **Functions**: Deploy serverless functions to Netlify (if needed)

---

## Resources

- [Netlify Terraform Provider](https://registry.terraform.io/providers/netlify/netlify/latest/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Custom Domains Guide](https://docs.netlify.com/domains-https/custom-domains/)
- [DNS Configuration](https://docs.netlify.com/domains-https/custom-domains/configure-external-dns/)
- [Build Configuration](https://docs.netlify.com/configure-builds/overview/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [SecureBase Module README](../landing-zone/modules/netlify-sites/README.md)

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review Netlify build logs in dashboard
3. Check Terraform state: `terraform show`
4. Consult module README: `landing-zone/modules/netlify-sites/README.md`
5. Netlify Support: https://www.netlify.com/support/

---

**Last Updated**: February 2026  
**Terraform Version**: 1.0+  
**Netlify Provider Version**: ~> 1.0
