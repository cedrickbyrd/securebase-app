# Terraform Installation & Phase 2 Deployment Setup

## Status
- **Terraform Binary**: NOT YET INSTALLED (blocker)
- **Configuration Files**: ✅ CORRECT (all customer_tier references removed)
- **Terraform Cache**: Created cleanup script ready to execute
- **Current Directory Issue**: Dev environment terminal has file system issue

## Quick Install: Terraform 1.5.7

### Option 1: Using apt (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y terraform
```

### Option 2: Direct Download (if apt fails)
```bash
cd /tmp
wget https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip
unzip terraform_1.5.7_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version
```

### Option 3: Using Homebrew
```bash
brew install terraform
```

## Post-Installation: Deploy Phase 2

Once terraform is installed:

```bash
# 1. Navigate to landing zone
cd /workspaces/securebase-app/landing-zone

# 2. Run cache cleanup script (already created)
bash FIX_TERRAFORM_CACHE.sh

# 3. Initialize terraform with upgrade
terraform init -upgrade

# 4. Validate configuration
terraform validate

# 5. Plan deployment
terraform plan -lock=false -var-file=environments/dev/terraform.tfvars -out=tfplan

# 6. Apply configuration
terraform apply tfplan
```

## Remote State Setup (AWS S3 + DynamoDB)

Bootstrap and enable always-on remote state:

```bash
# 0) Bootstrap backend resources (S3 bucket + DynamoDB table)
ENV=dev REGION=us-east-1 ORG=securebase bash landing-zone/BOOTSTRAP_BACKEND.sh

# 1) Update backend config if needed
# Edit: landing-zone/environments/dev/backend.hcl
#   bucket = "securebase-terraform-state-dev"
#   key    = "landing-zone/terraform.tfstate"
#   region = "us-east-1"
#   encrypt = true
#   use_lockfile = true   # (preferred; avoids DynamoDB deprecation warning)

# 2) Initialize Terraform with backend config
cd landing-zone
terraform init -backend-config=environments/dev/backend.hcl -upgrade

# 3) If migrating existing local state
terraform init -migrate-state -backend-config=environments/dev/backend.hcl
```

### Other Environments

Use the env-specific backend configs:

```bash
# staging
terraform init -backend-config=environments/staging/backend.hcl -upgrade

# production
terraform init -backend-config=environments/production/backend.hcl -upgrade
```

Template to create new env configs: see [landing-zone/environments/backend.hcl.example](landing-zone/environments/backend.hcl.example).

### Makefile shortcuts (recommended)

```bash
# Bootstrap backend (creates S3/DynamoDB)
make -C landing-zone bootstrap ENV=dev ORG=securebase REGION=us-east-1

# Initialize with remote backend
make -C landing-zone init ENV=dev

# Safe init (enforces backend.hcl usage)
make -C landing-zone safe-init ENV=dev

# Optional: migrate local state
make -C landing-zone migrate ENV=dev

# Validate, plan and apply
make -C landing-zone validate
make -C landing-zone plan ENV=dev
make -C landing-zone apply
```

Environment-specific runs:
```bash
# Staging
make -C landing-zone init-staging
make -C landing-zone plan-staging
make -C landing-zone apply-staging

# Production
make -C landing-zone init-prod
make -C landing-zone plan-prod
make -C landing-zone apply-prod
```

## What Gets Deployed

With Phase 2 deployment, you'll provision:
- **9 Customer VPCs** (one per customer with unique CIDR blocks)
- **18 Subnets** (2 per customer: public + private)
- **Internet Gateways** (one per customer)
- **NAT Gateways** (for private subnet egress)
- **Route Tables** (public and private per customer)
- **Customer Organizational Units** (in AWS Organizations)
- **Per-Customer Lambda Functions** (for API execution)
- **RDS Proxy** (for connection pooling)
- **Secrets Manager** (for DB credentials)

## Clients Being Deployed

The following 9 customers will be deployed:

| Customer | Framework | Tier | Account ID | VPC CIDR |
|----------|-----------|------|-----------|----------|
| acme-finance | soc2 | fintech | 123456789012 | 10.1.0.0/16 |
| medicorp-health | hipaa | healthcare | 234567890123 | 10.2.0.0/16 |
| techgov-federal | fedramp | gov-federal | 345678901234 | 10.3.0.0/16 |
| quantumbank-fintech | soc2 | fintech | 456789012345 | 10.4.0.0/16 |
| startup-standard | cis | standard | 567890123456 | 10.5.0.0/16 |
| metabank-fintech | soc2 | fintech | 678901234567 | 10.6.0.0/16 |
| guardian-health | hipaa | healthcare | 789012345678 | 10.7.0.0/16 |
| statecorp-govfed | fedramp | gov-federal | 890123456789 | 10.8.0.0/16 |
| crossbank-fintech | soc2 | fintech | 901234567890 | 10.9.0.0/16 |

## Estimated Deployment Time

- **terraform plan**: 2-3 minutes
- **terraform apply**: 10-15 minutes
- **Total**: ~20 minutes

## Troubleshooting

### Error: "terraform: command not found"
→ Run installation command from Option 1 or 2 above

### Error: "AWS credentials not configured"
→ AWS CLI credentials are already set up; error is informational only

### Error: "customer_tier undeclared"
→ Run `bash FIX_TERRAFORM_CACHE.sh` to clear cache

### Error: "resource already exists"
→ State was already created in Phase 1; review terraform.tfstate

## Next Steps After Deployment

Once Phase 2 terraform deployment completes:

1. **Deploy Phase 2 Backend** (FastAPI + PostgreSQL)
   ```bash
   cd /workspaces/securebase-app/phase2-backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

2. **Deploy Phase 3a Portal** (React frontend for customers)
   ```bash
   cd /workspaces/securebase-app/phase3a-portal
   npm install
   npm run build
   npm run preview
   ```

3. **Connect Portal to Backend**
   - Update `API_BASE_URL` in phase3a-portal/src/services/apiService.js
   - Restart portal application

## References

- Terraform Docs: https://www.terraform.io/docs
- AWS Terraform Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- SecureBase Project Overview: [Securebase-ProductDefinition.md](Securebase-ProductDefinition.md)
- Deployment Guide: [landing-zone/DEPLOYMENT_GUIDE.md](landing-zone/DEPLOYMENT_GUIDE.md)
