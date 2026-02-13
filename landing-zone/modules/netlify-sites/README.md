# Netlify Sites Module

## Overview
This Terraform module manages Netlify deployments for SecureBase's marketing site and customer portal demo. It provides declarative infrastructure-as-code for Netlify site configuration, build settings, custom domains, and deployment automation.

**Important Note**: This module uses the Netlify Terraform provider (~> 1.0). The exact resource schema may vary based on the provider version. Please consult the [official Netlify Terraform provider documentation](https://registry.terraform.io/providers/netlify/netlify/latest/docs) for the most up-to-date resource specifications and adjust the configuration as needed.

## Features

### ✅ Automated Site Management
- **Marketing Site**: Production marketing site at securebase.io
- **Portal Demo**: Customer portal demo at portal-demo.securebase.io
- **GitHub Integration**: Automatic deployments on push to main branch
- **Build Configuration**: Declarative build commands, environment variables, and publish directories

### ✅ Custom Domains
- Configurable custom domains for both sites
- Automated DNS configuration via Netlify
- Domain validation built-in

### ✅ Environment Variables
- Marketing site: `VITE_ENV=production`, `NODE_VERSION=22`
- Portal demo: `VITE_USE_MOCK_API=true`, `VITE_ENV=demo`, `VITE_ANALYTICS_ENABLED=false`, `NODE_VERSION=22`
- All variables managed declaratively via Terraform

### ✅ Manual Deployment Hooks
- Build hooks for manual deployments outside of Git pushes
- Useful for cache clearing or manual rebuilds
- Webhook URLs provided as sensitive outputs

## Prerequisites

1. **Netlify Account**: Sign up at https://app.netlify.com
2. **Netlify API Token**: Generate at https://app.netlify.com/user/applications#personal-access-tokens
3. **GitHub Access**: Netlify needs read access to your GitHub repository
4. **DNS Access**: Ability to configure DNS records for custom domains

## Input Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `netlify_token` | string | (required) | Netlify API token - **SENSITIVE** |
| `github_owner` | string | `"cedrickbyrd"` | GitHub repository owner |
| `github_repo` | string | `"securebase-app"` | GitHub repository name |
| `marketing_domain` | string | `"securebase.io"` | Custom domain for marketing site |
| `portal_demo_domain` | string | `"portal-demo.securebase.io"` | Custom domain for portal demo |
| `tags` | map(string) | `{}` | Common tags for resources |

### Variable Validation

**Domain names** must be valid DNS names (e.g., `example.com`, `subdomain.example.com`)

## Outputs

### Marketing Site
- `marketing_site_url` - Netlify-generated URL
- `marketing_site_id` - Netlify site ID
- `marketing_deploy_url` - Full HTTPS URL
- `marketing_custom_domain` - Configured custom domain
- `marketing_build_hook_url` - Webhook for manual deployments (sensitive)

### Portal Demo
- `portal_demo_url` - Netlify-generated URL
- `portal_demo_site_id` - Netlify site ID
- `portal_demo_deploy_url` - Full HTTPS URL
- `portal_demo_custom_domain` - Configured custom domain
- `portal_demo_build_hook_url` - Webhook for manual deployments (sensitive)

### Summary
- `deployment_summary` - Combined deployment information

## Usage Example

```hcl
# In landing-zone/environments/dev/main.tf

provider "netlify" {
  token = var.netlify_token
}

module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
  
  tags = {
    Project     = "SecureBase"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

# Access outputs
output "netlify_marketing_url" {
  value = module.netlify_sites.marketing_site_url
}

output "netlify_portal_demo_url" {
  value = module.netlify_sites.portal_demo_url
}
```

## How to Obtain Netlify API Token

1. Log in to Netlify: https://app.netlify.com
2. Navigate to **User Settings** → **Applications**
3. Scroll to **Personal Access Tokens**
4. Click **New access token**
5. Enter a description (e.g., "Terraform SecureBase")
6. Click **Generate token**
7. **Copy the token immediately** (you won't be able to see it again)

### Storing the Token Securely

**Option 1: AWS Secrets Manager** (Recommended for Production)
```bash
# Store token in AWS Secrets Manager
aws secretsmanager create-secret \
  --name netlify-api-token \
  --secret-string "your-netlify-token-here" \
  --region us-east-1

# Retrieve in Terraform
data "aws_secretsmanager_secret_version" "netlify_token" {
  secret_id = "netlify-api-token"
}

locals {
  netlify_token = jsondecode(data.aws_secretsmanager_secret_version.netlify_token.secret_string)
}
```

**Option 2: Environment Variable** (Development)
```bash
# Set environment variable
export TF_VAR_netlify_token="your-netlify-token-here"

# Terraform will automatically use TF_VAR_* environment variables
terraform plan
```

**Option 3: Terraform Variables File** (Not Recommended - use .gitignore)
```hcl
# terraform.tfvars (DO NOT COMMIT)
netlify_token = "your-netlify-token-here"
```

**Important**: Never commit tokens to Git. Add to `.gitignore`:
```
terraform.tfvars
*.tfvars
!*.tfvars.example
```

## How to Import Existing Netlify Sites

## Importing Existing SecureBase Sites

The SecureBase project has two existing Netlify sites:
1. **Marketing Site**: tximhotep.com (formerly securebase-app.netlify.app)
2. **Demo Portal**: demo.securebase.tximhotep.com (formerly securebase-demo.netlify.app)

### Quick Import

Run the automated import script:

```bash
./scripts/import-netlify-sites.sh
```

The script will:
- Check prerequisites (Terraform, Netlify CLI, API token)
- Prompt for site IDs from Netlify Dashboard
- Import environment variable resources
- Verify the import with `terraform plan`

### Manual Import (Alternative)

If you prefer to import manually:

1. Get Site IDs from Netlify Dashboard:
   - Marketing: https://app.netlify.com/sites/securebase-app/settings/general
   - Demo: https://app.netlify.com/sites/securebase-demo/settings/general

2. Navigate to environment directory:
   ```bash
   cd landing-zone/environments/dev
   ```

3. Import environment variables (replace SITE_ID):
   ```bash
   # Marketing site
   terraform import 'module.netlify_sites.netlify_environment_variable.marketing_node_version' 'MARKETING_SITE_ID:NODE_VERSION'
   terraform import 'module.netlify_sites.netlify_environment_variable.marketing_vite_env' 'MARKETING_SITE_ID:VITE_ENV'
   
   # Demo portal
   terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_node_version' 'DEMO_SITE_ID:NODE_VERSION'
   terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_mock_api' 'DEMO_SITE_ID:VITE_USE_MOCK_API'
   terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_vite_env' 'DEMO_SITE_ID:VITE_ENV'
   terraform import 'module.netlify_sites.netlify_environment_variable.portal_demo_analytics' 'DEMO_SITE_ID:VITE_ANALYTICS_ENABLED'
   ```

4. Verify:
   ```bash
   terraform plan -target=module.netlify_sites
   ```

### Expected Outcome

After import, `terraform plan` should show:
- ✅ "No changes" if environment variables already match
- ⚠️ Resources to create if environment variables don't exist in Netlify
- ✅ Data sources will reference existing sites automatically (no import needed)

### Verification

Run verification:
```bash
terraform state list | grep netlify
```

Expected output:
```
module.netlify_sites.data.netlify_site.marketing
module.netlify_sites.data.netlify_site.portal_demo
module.netlify_sites.netlify_environment_variable.marketing_node_version
module.netlify_sites.netlify_environment_variable.marketing_vite_env
module.netlify_sites.netlify_environment_variable.portal_demo_analytics
module.netlify_sites.netlify_environment_variable.portal_demo_mock_api
module.netlify_sites.netlify_environment_variable.portal_demo_node_version
module.netlify_sites.netlify_environment_variable.portal_demo_vite_env
```

## General Netlify Sites Import

If you have other Netlify sites deployed manually (not the SecureBase sites above), you can import them into Terraform:

### Step 1: Get Site IDs
```bash
# Using Netlify CLI
netlify sites:list

# Or from Netlify dashboard:
# https://app.netlify.com/sites/<site-name>/settings/general
# Look for "Site ID" or "API ID"
```

### Step 2: Import into Terraform State
```bash
cd landing-zone/environments/dev

# Import marketing site
terraform import 'module.netlify_sites.netlify_site.marketing' <marketing-site-id>

# Import portal demo site
terraform import 'module.netlify_sites.netlify_site.portal_demo' <portal-demo-site-id>

# Import build settings
terraform import 'module.netlify_sites.netlify_build_settings.marketing' <marketing-site-id>
terraform import 'module.netlify_sites.netlify_build_settings.portal_demo' <portal-demo-site-id>

# Import custom domains
terraform import 'module.netlify_sites.netlify_site_domain.marketing' <marketing-site-id>:<domain>
terraform import 'module.netlify_sites.netlify_site_domain.portal_demo' <portal-demo-site-id>:<domain>
```

### Step 3: Verify Import
```bash
terraform plan

# Should show "No changes" if configuration matches existing resources
```

## Migration from Manual Netlify Setup

### Before Migration
1. **Backup existing settings**: Document all environment variables, build commands, and configurations
2. **Note Site IDs**: Copy from Netlify dashboard (Settings → General → Site information)
3. **Test in development**: Import sites in a non-production environment first

### Migration Steps

1. **Create module configuration** (as shown in Usage Example above)

2. **Import existing sites** (see "How to Import Existing Netlify Sites")

3. **Verify configuration**:
   ```bash
   terraform plan
   # Should show minimal or no changes
   ```

4. **Apply any needed changes**:
   ```bash
   terraform apply
   ```

5. **Test deployments**:
   - Push a commit to main branch
   - Verify builds trigger automatically
   - Check environment variables are correct

6. **Update CI/CD** (if applicable):
   - GitHub Actions can still use `NETLIFY_SITE_ID` secrets
   - Consider migrating to build hooks for manual deployments

### Rollback Plan
If migration fails:
1. Remove imported resources from state:
   ```bash
   terraform state rm 'module.netlify_sites.netlify_site.marketing'
   terraform state rm 'module.netlify_sites.netlify_site.portal_demo'
   ```
2. Netlify sites remain unchanged
3. Reconfigure manually via Netlify dashboard

## DNS Configuration

After deploying sites with custom domains, configure DNS:

### Marketing Site (securebase.io)
```
# Add to your DNS provider (e.g., Route53, Cloudflare, Namecheap)

# Option 1: ALIAS/ANAME record (recommended)
securebase.io.  ALIAS   <netlify-site-url>

# Option 2: A record to Netlify load balancer
securebase.io.  A       75.2.60.5

# HTTPS Certificate
# Netlify auto-provisions Let's Encrypt certificates after DNS verification
```

### Portal Demo (portal-demo.securebase.io)
```
# Add to your DNS provider

# CNAME record
portal-demo.securebase.io.  CNAME   <netlify-demo-url>
```

### Verification
```bash
# Check DNS propagation
dig securebase.io
dig portal-demo.securebase.io

# Verify HTTPS
curl -I https://securebase.io
curl -I https://portal-demo.securebase.io
```

**Note**: DNS propagation can take 24-48 hours. Netlify will automatically provision SSL certificates once DNS is verified.

## Deployment

### Initial Deployment
```bash
# Navigate to environment directory
cd landing-zone/environments/dev

# Initialize Terraform (downloads Netlify provider)
terraform init

# Plan deployment
terraform plan -target=module.netlify_sites

# Apply configuration
terraform apply -target=module.netlify_sites
```

### Updating Sites
```bash
# After changing module configuration
terraform plan
terraform apply
```

### Manual Build Trigger
```bash
# Get build hook URL
terraform output netlify_sites_marketing_build_hook_url

# Trigger build via webhook
curl -X POST <build-hook-url>
```

## Troubleshooting

### Issue: `Error: invalid Netlify API token`
**Cause**: Token is expired, invalid, or not set correctly  
**Solution**: 
1. Verify token is correct: `echo $TF_VAR_netlify_token`
2. Generate new token from Netlify dashboard
3. Update token in Secrets Manager or environment variable

### Issue: `Error: site with name "X" already exists`
**Cause**: Site name is globally unique on Netlify  
**Solution**: 
1. Import existing site (see "How to Import Existing Netlify Sites")
2. Or change site name in `main.tf` to something unique

### Issue: `Error: failed to connect to GitHub repository`
**Cause**: Netlify doesn't have GitHub access  
**Solution**:
1. Go to https://app.netlify.com/user/applications
2. Connect GitHub account
3. Grant access to repository
4. Retry Terraform apply

### Issue: Custom domain shows "DNS not configured"
**Cause**: DNS records not pointing to Netlify  
**Solution**:
1. Check Netlify dashboard for required DNS records
2. Add records to your DNS provider
3. Wait for DNS propagation (up to 48 hours)
4. Verify with `dig <domain>`

### Issue: Build fails with "command not found"
**Cause**: Build command incorrect or dependencies missing  
**Solution**:
1. Check build logs in Netlify dashboard
2. Verify `build_command` in module configuration
3. Ensure `package.json` has required scripts
4. Check Node version compatibility

### Issue: Environment variables not applied
**Cause**: Terraform state out of sync  
**Solution**:
```bash
# Force refresh
terraform refresh

# Or destroy and recreate build settings
terraform destroy -target=module.netlify_sites.netlify_build_settings.marketing
terraform apply -target=module.netlify_sites.netlify_build_settings.marketing
```

## Cost Considerations

### Netlify Free Tier
- ✅ **Included**: 300 build minutes/month
- ✅ **Included**: 100 GB bandwidth/month
- ✅ **Included**: Automatic HTTPS
- ✅ **Included**: Continuous deployment
- ✅ **Included**: Custom domains

### Paid Features (if needed)
- **Pro**: $19/month per member (1,000 build minutes, 400 GB bandwidth)
- **Business**: $99/month per member (advanced features)

### Monthly Estimate (Free Tier)
- Marketing site: 50 builds/month = **~25 minutes**
- Portal demo: 50 builds/month = **~25 minutes**
- Total build minutes: **~50/month** ✅ Well under 300 limit
- Bandwidth: **<10 GB/month** ✅ Well under 100 GB limit

**Total Cost: $0/month** (assuming Free Tier usage)

## Best Practices

1. **Use Environment Variables**: Store all configuration in Terraform, not netlify.toml
2. **Version Control**: Keep `netlify.toml` in Git for local development reference
3. **Separate Environments**: Use different Netlify teams/sites for dev/staging/prod
4. **Monitor Build Times**: Set up alerts for failed builds
5. **Use Build Hooks**: For deployments outside Git workflow
6. **Regular Backups**: Export site configuration periodically
7. **DNS TTL**: Set low TTL (300s) before DNS changes, increase after verification

## Security Recommendations

1. **Protect API Tokens**: Never commit to Git, use Secrets Manager
2. **Rotate Tokens**: Rotate Netlify tokens every 90 days
3. **Deploy Keys**: Netlify auto-generates deploy keys per site
4. **HTTPS Only**: Netlify enforces HTTPS automatically
5. **Branch Deploys**: Lock production to main branch only
6. **Access Control**: Use Netlify teams for multi-user access

## Next Steps

- [ ] Configure DNS records for custom domains
- [ ] Set up Netlify alerts for failed builds
- [ ] Configure branch deploys for pull request previews
- [ ] Add custom headers in netlify.toml (CSP, HSTS, etc.)
- [ ] Set up Analytics (Netlify Analytics or Google Analytics)
- [ ] Configure redirects and rewrites in netlify.toml
- [ ] Add Netlify Functions for serverless API endpoints (if needed)

## Resources

- [Netlify Terraform Provider Docs](https://registry.terraform.io/providers/netlify/netlify/latest/docs)
- [Netlify Site Resource](https://registry.terraform.io/providers/netlify/netlify/latest/docs/resources/site)
- [Netlify Build Settings](https://docs.netlify.com/configure-builds/overview/)
- [Custom Domains Guide](https://docs.netlify.com/domains-https/custom-domains/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)
