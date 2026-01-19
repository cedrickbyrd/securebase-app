# 🔧 Terraform Cache Corruption - How to Fix

## What's Happening

You're seeing errors about line 45 in main.tf having backticks, but when we look at the files, they're clean. This means:

1. **Old `.terraform` cache** from a previous (corrupted) state
2. **Stale module cache** from old deployments
3. **Running terraform from wrong directory**

---

## Solution: Full Clean Slate

### Step 1: Remove All Terraform Cache

```bash
# Go to root of repo
cd /workspaces/securebase-app

# Remove ALL terraform state/cache
rm -rf landing-zone/.terraform
rm -rf landing-zone/.terraform.lock.hcl
rm -rf landing-zone/terraform.tfstate*
rm -rf landing-zone/environments/dev/.terraform
rm -rf landing-zone/environments/dev/.terraform.lock.hcl
rm -rf landing-zone/environments/dev/terraform.tfstate*
```

### Step 2: Verify Files Are Clean

```bash
# Check main terraform file
head -50 landing-zone/main.tf | grep -E '```|After 2+'
# Should return nothing (no backticks)

# Check outputs file  
grep -E '```|= { \.\.\. }' landing-zone/outputs.tf
# Should return nothing (no invalid syntax)
```

### Step 3: Navigate to Correct Directory

```bash
cd landing-zone/environments/dev
pwd
# Should show: .../securebase-app/landing-zone/environments/dev
```

### Step 4: Fresh Initialize

```bash
terraform init
```

**This will:**
- Create clean `.terraform` directory
- Download fresh modules
- Set up state management properly

### Step 5: Validate

```bash
terraform validate
```

**Expected output:**
```
Success! The configuration is valid.
```

---

## Why This Works

1. **Removes corrupted cache** - The `.terraform` folder can get corrupted
2. **Downloads fresh modules** - Gets clean copies of all modules
3. **Fresh state** - Clears any stale Terraform state references
4. **Correct directory** - Running from the environment directory with its own config

---

## Complete Step-by-Step

```bash
# From repo root
cd /workspaces/securebase-app

# Clean everything
rm -rf landing-zone/.terraform landing-zone/.terraform.lock.hcl landing-zone/terraform.tfstate*
rm -rf landing-zone/environments/dev/.terraform landing-zone/environments/dev/.terraform.lock.hcl landing-zone/environments/dev/terraform.tfstate*

# Go to environment directory
cd landing-zone/environments/dev

# Verify we're in the right place
ls -la | grep -E 'terraform.tfvars|client.auto.tfvars'
# Should see both files

# Initialize fresh
terraform init

# Validate
terraform validate

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan
```

---

## If You Still Get Errors

Check that you're NOT running from the root:

```bash
# ❌ WRONG
cd landing-zone
terraform init  # ERROR!

# ✅ CORRECT  
cd landing-zone/environments/dev
terraform init  # OK!
```

---

## Diagnostic Commands

```bash
# Show current working directory
pwd

# Show what's in current directory
ls -la

# Show terraform version
terraform version

# Show terraform providers
terraform providers
```

---

## Still Having Issues?

Run the diagnostic script:

```bash
bash ../../diagnose.sh
```

This will verify:
- ✓ You're in the right directory
- ✓ Configuration files exist
- ✓ AWS credentials are configured
- ✓ Terraform is installed
- ✓ All required variables are declared

---

**After these steps, everything should work perfectly! 🚀**
