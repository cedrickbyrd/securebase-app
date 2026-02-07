# Terraform Validation Fixes

## Overview
This document describes the fixes applied to resolve Terraform validation errors in the SecureBase infrastructure code.

## Issues Fixed

### 1. API Gateway Stage Settings Error ✅

**Location:** `landing-zone/modules/api-gateway/main.tf` (line 846)

**Problem:**
```hcl
# INCORRECT - AWS Provider v5.x syntax error
settings {
  throttle {
    rate_limit  = var.default_rate_limit
    burst_limit = var.default_burst_limit
  }
}
```

**Error Message:**
```
Error: Unsupported block type
  on ../../modules/api-gateway/main.tf line 846, in resource "aws_api_gateway_stage" "main":
  846:   settings {
Blocks of type "settings" are not expected here.
```

**Root Cause:**
The `settings` block wrapper is not valid in AWS Provider v5.x. The correct syntax for throttle settings is to use `throttle_settings` directly on the stage resource.

**Solution:**
```hcl
# CORRECT - AWS Provider v5.x syntax
throttle_settings {
  rate_limit  = var.default_rate_limit
  burst_limit = var.default_burst_limit
}
```

**Reference:** [AWS Provider Documentation - aws_api_gateway_stage](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_stage)

---

### 2. Netlify Data Source Attribute Errors ✅

**Location:** `landing-zone/modules/netlify-sites/outputs.tf` (lines 6, 16, 30, 40, 53, 58)

**Problem:**
```hcl
# INCORRECT - 'default_domain' attribute does not exist
output "marketing_site_url" {
  value = data.netlify_site.marketing.default_domain
}
```

**Error Message:**
```
Error: Unsupported attribute
  on ../../modules/netlify-sites/outputs.tf line 6, in output "marketing_site_url":
   6:   value = data.netlify_site.marketing.default_domain
This object has no argument, nested block, or exported attribute named "default_domain".
```

**Root Cause:**
The Netlify Terraform Provider v0.4.0 `data.netlify_site` data source does not expose a `default_domain` attribute. The correct attribute for the site's primary URL is `url`.

**Solution:**
```hcl
# CORRECT - Netlify Provider v0.4.0 syntax
output "marketing_site_url" {
  value = data.netlify_site.marketing.url
}
```

**Changes Made:**
- Line 6: `default_domain` → `url`
- Line 16: `default_domain` → `url`
- Line 30: `default_domain` → `url`
- Line 40: `default_domain` → `url`
- Line 53: `default_domain` → `url` (in deployment_summary)
- Line 58: `default_domain` → `url` (in deployment_summary)

**Available Attributes:**
Based on Netlify Provider v0.4.0:
- ✅ `id` - Site ID
- ✅ `name` - Site name
- ✅ `url` - Primary Netlify URL (e.g., `site-name.netlify.app`)
- ✅ `custom_domain` - Custom domain if configured
- ❌ `default_domain` - Does not exist

---

### 3. Backend Configuration ✅

**Location:** `landing-zone/environments/dev/backend.hcl` and `main.tf`

**Current Configuration:**

`backend.hcl`:
```hcl
bucket         = "securebase-terraform-state-dev"
key            = "dev/securebase.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-terraform-locks"
encrypt        = true
```

`main.tf`:
```hcl
terraform {
  required_version = ">= 1.5.0"
  
  backend "s3" {}
}
```

**Status:** ✅ Configuration is correct

**Why It Works:**
The empty `backend "s3" {}` block is the recommended pattern when using `-backend-config` flag. This allows environment-specific backend configuration to be stored in separate files.

**Usage:**
```bash
cd landing-zone/environments/dev
terraform init -backend-config=backend.hcl
```

**Note:** If `terraform init` prompts for the bucket name, ensure you're using the `-backend-config=backend.hcl` flag. The configuration is correctly structured.

---

## Validation

### How to Validate Fixes

```bash
# Navigate to the environment directory
cd landing-zone/environments/dev

# Initialize Terraform with backend config
terraform init -backend-config=backend.hcl

# Validate the configuration
terraform validate

# Expected output:
# Success! The configuration is valid.

# Optional: Run a plan to check for issues
terraform plan
```

### Expected Results

After these fixes:
- ✅ `terraform validate` should run without errors
- ✅ API Gateway stage uses correct AWS Provider v5.x syntax
- ✅ Netlify outputs reference valid data source attributes
- ✅ Backend initialization works correctly with `-backend-config` flag

---

## Provider Versions

These fixes are compatible with:
- **Terraform:** >= 1.9.0
- **AWS Provider:** ~> 5.82.2
- **Netlify Provider:** ~> 0.4.0

---

## Summary

| Issue | Location | Fix Applied | Lines Changed |
|-------|----------|-------------|---------------|
| API Gateway `settings` block | `modules/api-gateway/main.tf` | Changed to `throttle_settings` | 1 block (4 lines) |
| Netlify `default_domain` attribute | `modules/netlify-sites/outputs.tf` | Changed to `url` | 6 lines |
| Backend configuration | `environments/dev/` | Verified (no changes needed) | 0 |

**Total Files Modified:** 2  
**Total Lines Changed:** 10 additions, 12 deletions (net -2 lines)

---

## Related Documentation

- [AWS API Gateway Stage - Terraform Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_stage)
- [Netlify Provider - Terraform Docs](https://registry.terraform.io/providers/netlify/netlify/latest/docs)
- [Terraform Backend Configuration](https://www.terraform.io/language/settings/backends/configuration)

---

## Troubleshooting

### If validation still fails:

1. **Clear Terraform cache:**
   ```bash
   cd landing-zone/environments/dev
   rm -rf .terraform .terraform.lock.hcl
   terraform init -backend-config=backend.hcl
   ```

2. **Verify provider versions:**
   ```bash
   terraform version
   terraform providers
   ```

3. **Check for syntax errors:**
   ```bash
   terraform fmt -check -recursive
   ```

4. **Review provider documentation:**
   - Ensure you're using the correct provider versions
   - Check for any breaking changes in provider updates

---

*Document Version: 1.0*  
*Last Updated: 2026-02-07*  
*Related PR: #[PR_NUMBER]*
