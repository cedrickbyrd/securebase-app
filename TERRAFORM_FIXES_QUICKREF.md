# Quick Reference: Terraform Validation Fixes

## ⚡ Quick Start

Run validation:
```bash
cd /home/runner/work/securebase-app/securebase-app
./validate-terraform-fixes.sh
```

Expected output: ✅ All syntax checks passed!

## 📋 What Was Fixed

### 1. Netlify Provider (v0.4.0 compatibility)
- ❌ `resource "netlify_site"` → ✅ `data "netlify_site"`
- ❌ `netlify_env_var` → ✅ `netlify_environment_variable`  
- ❌ `netlify_build_hook` → ✅ Removed (create manually)

### 2. API Gateway (AWS Provider v5.x)
- ❌ `throttle_settings { ... }` → ✅ `settings { throttle { ... } }`

### 3. S3 Lifecycle (AWS Provider v5.x)
- ❌ Missing `filter` block → ✅ Added `filter {}`

## 🔧 How to Deploy

### Prerequisites for Netlify Module
1. Create sites manually in Netlify:
   - securebase-marketing
   - securebase-portal-demo

2. Configure repository settings in Netlify UI:
   - Repository: cedrickbyrd/securebase-app
   - Branch: main

3. Set environment variable:
   ```bash
   export TF_VAR_netlify_token="your-token"
   ```

### Run Terraform Validation
```bash
cd landing-zone/environments/dev
terraform init
terraform validate
```

Expected: `Success! The configuration is valid.`

### Plan & Apply
```bash
# Plan all modules
terraform plan

# Or target specific module
terraform plan -target=module.netlify_sites
terraform plan -target=module.analytics
```

## 📚 Documentation

- Full details: `TERRAFORM_VALIDATION_FIXES.md`
- Validation script: `validate-terraform-fixes.sh`
- Deployment guide: `landing-zone/environments/dev/README.md`

## 🐛 Troubleshooting

**Netlify sites not found:**
- Create sites manually in Netlify UI first
- Verify site names match data source names

**Throttle settings error:**
- Check AWS provider version is ~> 5.82.2
- Verify `settings { throttle { } }` syntax

**Lifecycle filter missing:**
- Check for `filter {}` block in lifecycle rules
- AWS provider v5.x requires filter blocks

## ✅ Acceptance Criteria Status

- [x] `terraform validate` runs without errors
- [x] Netlify resources use provider v0.4.0 syntax
- [x] API Gateway uses correct `settings` block
- [x] S3 lifecycle rules include `filter` blocks
- [x] Code follows existing patterns
- [x] Comments explain provider limitations
