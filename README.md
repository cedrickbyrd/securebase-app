# securebase-app
# SecureBase Landing Zone v0.1

SecureBase is a production-grade AWS Landing Zone built with Terraform. It implements a multi-account strategy with automated security guardrails and centralized identity management.

## 🛡️ Security Guardrails
- **Immutable Audit Logs:** S3 Object Lock (Compliance Mode) prevents log tampering.
- **Organization Governance:** Service Control Policies (SCPs) to restrict Root user and enforce IAM Identity Center usage.
- **Data Protection:** Default EBS encryption enabled for all accounts.
- **Least Privilege:** Pre-defined SSO Permission Sets (Admin, Platform, Auditor).

## 🏗️ Architecture
The project follows a modular Terraform structure:
- `modules/org`: AWS Organizations and OUs.
- `modules/iam`: SSO Permission Sets and MFA roles.
- `modules/logging`: Centralized CloudWatch and S3 audit logs.

## 🚀 Getting Started
1. **Prerequisites:** AWS CLI configured and Terraform installed.
2. **Initialize:** `terraform init`
3. **Plan:** `terraform plan`
4. **Deploy:** `terraform apply`
