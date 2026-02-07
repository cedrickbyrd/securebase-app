# Terraform Validation Fixes - Summary

## Overview
This document summarizes the fixes applied to resolve Terraform validation errors in the SecureBase infrastructure code. All changes have been made to ensure compatibility with:
- Terraform >= 1.9.0
- AWS Provider ~> 5.82.2
- Netlify Provider ~> 0.4.0

## Changes Made

### 1. Netlify Provider Issues (modules/netlify-sites/main.tf)

**Problem**: The Netlify provider v0.4.0 does not support several resources that were being used.

**Changes**:
- ✅ **Replaced `netlify_site` resources with `data "netlify_site"` data sources**
  - Lines 21 and 67: Changed from `resource "netlify_site"` to `data "netlify_site"`
  - Sites must now be created manually in Netlify UI first
  - Terraform will reference existing sites via data source lookup

- ✅ **Replaced `netlify_env_var` with `netlify_environment_variable`**
  - Lines 41, 52 (marketing site)
  - Lines 87, 98, 109, 120 (portal demo site)
  - Updated all references from `netlify_site.*.id` to `data.netlify_site.*.id`

- ✅ **Removed `netlify_build_hook` resources**
  - Lines 135, 141: Removed unsupported build hook resources
  - Added documentation comments explaining manual creation in Netlify UI

- ✅ **Updated provider version constraint**
  - Changed `version = ">= 0.1.0"` to `version = "~> 0.4.0"` in `versions.tf`

- ✅ **Updated outputs.tf**
  - Changed all output references from `netlify_site.*` to `data.netlify_site.*`
  - Removed build hook outputs (not available in provider v0.4.0)
  - Added comment explaining manual build hook creation

**Documentation Added**:
```hcl
# PREREQUISITES - Sites must be created manually first:
# 1. Go to https://app.netlify.com and create two sites:
#    - securebase-marketing (for marketing site)
#    - securebase-portal-demo (for portal demo)
# 2. Configure each site with:
#    - Repository: cedrickbyrd/securebase-app
#    - Branch: main
#    - Build command: (as specified below)
#    - Publish directory: (as specified below)
# 3. Note the site IDs from Netlify dashboard (Settings → General → API ID)
# 4. Set the site names in variables and reference via data sources
#
# Provider v0.4.0 Limitations:
# - No `netlify_site` resource (sites must exist, use data source)
# - No `netlify_build_hook` resource (create manually in Netlify UI)
# - Use `netlify_environment_variable` instead of `netlify_env_var`
```

### 2. API Gateway Throttle Settings (modules/api-gateway/main.tf)

**Problem**: Line 845 had an invalid `throttle_settings` block incompatible with AWS Provider v5.x.

**Changes**:
- ✅ **Replaced `throttle_settings` with `settings` block**
  - Old syntax (AWS Provider v4):
    ```hcl
    throttle_settings {
      rate_limit  = var.default_rate_limit
      burst_limit = var.default_burst_limit
    }
    ```
  - New syntax (AWS Provider v5):
    ```hcl
    settings {
      throttle {
        rate_limit  = var.default_rate_limit
        burst_limit = var.default_burst_limit
      }
    }
    ```

- ✅ **Added explanatory comment**:
  ```hcl
  # AWS provider v5.x uses 'settings' instead of 'throttle_settings'
  ```

### 3. S3 Lifecycle Configuration (modules/analytics/dynamodb.tf)

**Problem**: Line 216 was missing required `filter` block in S3 lifecycle rule (AWS Provider v5.x requirement).

**Changes**:
- ✅ **Added `filter {}` block to lifecycle rule**
  - Added empty filter block at line 223 (after line 221)
  - This ensures all objects in the bucket are subject to the lifecycle rule
  - Complies with AWS Provider v5.x requirements

- ✅ **Added explanatory comment**:
  ```hcl
  # AWS provider v5.x requires filter block for lifecycle rules
  filter {}
  ```

**Before**:
```hcl
resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
```

**After**:
```hcl
resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    # AWS provider v5.x requires filter block for lifecycle rules
    filter {}

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
```

## Files Modified

1. `landing-zone/modules/netlify-sites/main.tf` - Resource to data source conversion, environment variable updates
2. `landing-zone/modules/netlify-sites/outputs.tf` - Output references updated for data sources
3. `landing-zone/modules/netlify-sites/versions.tf` - Provider version constraint updated
4. `landing-zone/modules/api-gateway/main.tf` - Throttle settings syntax updated
5. `landing-zone/modules/analytics/dynamodb.tf` - Lifecycle filter block added

## Validation Steps

To validate these changes, run the following from the correct directory:

```bash
cd landing-zone/environments/dev
terraform init
terraform validate
```

### Expected Output

```
Success! The configuration is valid.
```

### Prerequisites for Netlify Module

Before deploying the Netlify module, you must:

1. **Create sites manually in Netlify UI**:
   - Go to https://app.netlify.com
   - Create site "securebase-marketing"
   - Create site "securebase-portal-demo"

2. **Configure build settings for each site**:
   - Repository: cedrickbyrd/securebase-app
   - Branch: main
   - Build command: 
     - Marketing: `npm run build`
     - Portal Demo: `cd phase3a-portal && npm run build`
   - Publish directory:
     - Marketing: `dist`
     - Portal Demo: `phase3a-portal/dist`

3. **Create build hooks manually** (optional):
   - Go to Site settings → Build & deploy → Build hooks
   - Add build hook named "Manual Deploy - Marketing Site"
   - Add build hook named "Manual Deploy - Portal Demo"
   - Save webhook URLs for manual deployments

4. **Set Netlify token**:
   ```bash
   export TF_VAR_netlify_token="your-netlify-api-token"
   ```

## Testing the Changes

### Test 1: Terraform Syntax Validation
```bash
cd landing-zone/environments/dev
terraform init
terraform validate
```

### Test 2: Plan Netlify Module (requires manual site creation)
```bash
cd landing-zone/environments/dev
terraform plan -target=module.netlify_sites
```

### Test 3: Plan Analytics Module
```bash
cd landing-zone/environments/dev
terraform plan -target=module.analytics
```

### Test 4: Plan Full Configuration
```bash
cd landing-zone/environments/dev
terraform plan
```

## Breaking Changes

### Netlify Sites Module

**IMPORTANT**: The Netlify sites module now requires **manual site creation** before Terraform deployment.

**Migration Steps**:
1. Create sites manually in Netlify UI (see Prerequisites above)
2. Note the site names (must match the data source names)
3. Run `terraform plan` to verify Terraform can find the sites
4. Run `terraform apply` to manage environment variables

**No state migration required** - The module will automatically reference existing sites via data sources.

## Compliance Notes

All changes maintain compliance with:
- ✅ Terraform best practices
- ✅ AWS Provider v5.x syntax requirements  
- ✅ Netlify Provider v0.4.0 limitations
- ✅ Existing module patterns and conventions
- ✅ Infrastructure as Code (IaC) security standards

## References

- [AWS Provider v5.x Upgrade Guide](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/guides/version-5-upgrade)
- [Netlify Provider v0.4.0 Documentation](https://registry.terraform.io/providers/netlify/netlify/0.4.0/docs)
- [Terraform aws_api_gateway_stage Resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_stage)
- [Terraform aws_s3_bucket_lifecycle_configuration Resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_lifecycle_configuration)

## Support

For issues or questions:
1. Review this document
2. Check the Terraform validate output
3. Consult the provider documentation links above
4. Review the updated module code for inline comments
