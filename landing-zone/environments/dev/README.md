# ⚠️ IMPORTANT: READ THIS FIRST!

## The ONLY Way to Deploy SecureBase PaaS

### ❌ WRONG - Do NOT run terraform from here:
```bash
# WRONG DIRECTORY ❌
cd /workspaces/securebase-app/landing-zone
terraform plan       # ❌ This will fail!
```

### ✅ CORRECT - Run terraform from here:
```bash
# CORRECT DIRECTORY ✅
cd /workspaces/securebase-app/landing-zone/environments/dev
terraform init
terraform plan
terraform apply
```

---

## Step-by-Step Deployment

### 1️⃣ Navigate to the Right Directory
```bash
cd landing-zone/environments/dev
```

**Verify you're in the right place:**
```bash
pwd  # Should output: .../securebase-app/landing-zone/environments/dev
ls   # Should show: terraform.tfvars, client.auto.tfvars, variables.tf, main.tf
```

### 2️⃣ Initialize Terraform
```bash
terraform init
```

**What this does:**
- Downloads AWS provider
- Creates .terraform directory (in THIS directory, not root)
- Sets up state management

### 3️⃣ Validate Configuration
```bash
terraform validate
```

**What this does:**
- Checks syntax of all .tf files
- Verifies variable declarations
- Ensures all modules are referenced correctly

### 4️⃣ Plan Deployment
```bash
terraform plan -out=tfplan
```

**What this does:**
- Reads your configuration files
- Compares with AWS (current state)
- Shows what will be created/changed/destroyed
- Saves plan to tfplan file

**Review the plan carefully:**
- Should create 1 Organization
- Should create 4 OUs (one per tier)
- Should create 4 customer accounts
- Should attach policies to OUs

### 5️⃣ Apply Configuration
```bash
terraform apply tfplan
```

**What this does:**
- Executes the plan
- Creates resources in AWS
- Saves state to local terraform.tfstate

### 6️⃣ View Results
```bash
terraform output
```

**You should see:**
```
organization_id = "o-xxxxxxxxxxxxx"
client_account_ids = {
  "blue-cross" = "123456789012"
  "dept-of-energy" = "555566667777"
  "goldman-fin" = "987654321098"
  "startup-dev" = "111122223333"
}
customer_ou_ids = {
  fintech = "ou-xxxx-xxxx"
  gov_federal = "ou-xxxx-xxxx"
  healthcare = "ou-xxxx-xxxx"
  standard = "ou-xxxx-xxxx"
}
```

---

## Common Mistakes & How to Fix Them

### ❌ Mistake 1: Running from Root Directory
```bash
cd landing-zone     # WRONG!
terraform plan      # Will fail with errors
```

**Fix:**
```bash
cd landing-zone/environments/dev     # CORRECT!
terraform plan
```

### ❌ Mistake 2: Old State Conflicts
If you previously ran terraform from the root directory:

**Error:** "Objects have changed outside of Terraform"

**Fix:**
```bash
# Remove old state from root
rm -rf landing-zone/.terraform
rm -f landing-zone/terraform.tfstate*

# Navigate to correct directory
cd landing-zone/environments/dev

# Re-initialize (creates fresh state)
terraform init
terraform plan
```

### ❌ Mistake 3: Variables Not Found
**Error:** "Value for undeclared variable"

**Cause:** Running from wrong directory where root variables.tf is used instead of environment variables.tf

**Fix:** Make sure you're in `landing-zone/environments/dev/` (see Mistake 1)

### ❌ Mistake 4: Client Configuration Missing Attributes
**Error:** "element 'customer': attributes 'framework' is required"

**Fix:** Edit `client.auto.tfvars` and add framework to ALL clients:
```hcl
clients = {
  "customer-name" = {
    tier      = "healthcare"    # ✓ required
    account_id = "111122223333"  # ✓ required
    prefix     = "customer"      # ✓ required
    framework  = "hipaa"         # ✓ REQUIRED! (soc2, fedramp, cis, or hipaa)
    tags = {}
  }
}
```

---

## Quick Troubleshooting Checklist

Before running terraform, verify:

- [ ] Current directory is `landing-zone/environments/dev`
- [ ] Both `terraform.tfvars` and `client.auto.tfvars` exist
- [ ] AWS credentials configured: `aws sts get-caller-identity`
- [ ] Terraform installed: `terraform version`
- [ ] No stale .terraform directory in root `landing-zone/`
- [ ] All clients in client.auto.tfvars have `framework` attribute
- [ ] All required fields present in terraform.tfvars

**Run diagnostics:**
```bash
bash diagnose.sh
```

---

## Automated Deployment Script

Use our automated deployment script (handles all the above):

```bash
bash deploy.sh
```

This script will:
1. Clean old state
2. Navigate to correct directory
3. Verify configuration files
4. Run terraform init
5. Validate configuration
6. Run terraform plan
7. Ask for confirmation
8. Run terraform apply
9. Display outputs

---

## Netlify Deployments (Marketing Site & Portal Demo)

### Prerequisites
1. **Netlify API Token**: Generate at https://app.netlify.com/user/applications#personal-access-tokens
2. **Set Environment Variable**:
   ```bash
   export TF_VAR_netlify_token="your-netlify-token-here"
   ```

### Quick Start
```bash
cd landing-zone/environments/dev
terraform init
terraform plan -target=module.netlify_sites
terraform apply -target=module.netlify_sites
```

### Import Existing Netlify Sites
If you already have sites deployed on Netlify:

```bash
# Get site IDs from Netlify dashboard
# Settings → General → Site information → API ID

# Import marketing site
terraform import 'module.netlify_sites.netlify_site.marketing' <marketing-site-id>

# Import portal demo site
terraform import 'module.netlify_sites.netlify_site.portal_demo' <portal-demo-site-id>

# Verify import
terraform plan -target=module.netlify_sites
```

### Verify Netlify Deployment
```bash
# View outputs
terraform output netlify_marketing_site_url
terraform output netlify_portal_demo_url
terraform output netlify_deployment_summary

# Test sites
curl -I https://securebase.io
curl -I https://portal-demo.securebase.io
```

### DNS Configuration
After deploying, configure DNS for custom domains:

**Marketing Site (securebase.io)**:
```
# Add to your DNS provider
securebase.io.  ALIAS   <netlify-marketing-url>
# Or: securebase.io.  A   75.2.60.5
```

**Portal Demo (portal-demo.securebase.io)**:
```
# Add to your DNS provider
portal-demo.securebase.io.  CNAME   <netlify-demo-url>
```

### Troubleshooting Netlify Deployments
- **Invalid token**: Verify `TF_VAR_netlify_token` is set correctly
- **Site already exists**: Import existing site (see above)
- **DNS not configured**: Add DNS records to your DNS provider
- **Build fails**: Check build logs in Netlify dashboard

See `landing-zone/modules/netlify-sites/README.md` for detailed documentation.

---

## Directory Structure Reference

```
securebase-app/
│
├── landing-zone/                    # DO NOT run terraform from here!
│   ├── main.tf
│   ├── variables.tf
│   │
│   └── environments/dev/             # ✅ RUN TERRAFORM FROM HERE!
│       ├── terraform.tfvars          # Edit this for your config
│       ├── client.auto.tfvars        # Edit this for customer deployments
│       ├── variables.tf
│       ├── main.tf
│       └── outputs.tf
│
├── docs/
├── src/
└── [other files]
```

---

## Success Indicators

After successful `terraform apply`:

✅ Output shows organization_id
✅ Output shows 4 OUs in customer_ou_ids
✅ Output shows 4 accounts in client_account_ids
✅ No errors in final message
✅ AWS Organizations console shows your org with new accounts

---

## Next Steps After Deployment

1. **Set up IAM Identity Center:**
   - Log into management account
   - Configure users and groups
   - Assign permission sets to accounts

2. **Verify compliance:**
   - Check CloudTrail is collecting logs
   - Verify Config rules are running
   - Monitor Security Hub findings

3. **Build Backend API:**
   - Review docs/PAAS_ARCHITECTURE.md
   - Start implementing REST API
   - Connect to Terraform orchestration

---

## 🎯 TL;DR

```bash
cd landing-zone/environments/dev
terraform init
terraform plan
terraform apply
```

**That's it!** Your multi-tenant PaaS will be deployed.

---

## Support

- **Deployment issues:** See TROUBLESHOOTING.md
- **Architecture questions:** See docs/PAAS_ARCHITECTURE.md
- **Operations guide:** See landing-zone/MULTI_TENANT_GUIDE.md
- **Run diagnostics:** `bash diagnose.sh`
- **Automated deploy:** `bash deploy.sh`

**Questions? Check the INDEX.md for complete documentation map.**
