# SecureBase PaaS - Multi-Tenant Architecture Guide

## Overview

SecureBase has been restructured to support a **Platform-as-a-Service (PaaS)** model with multi-tenancy capabilities. This enables you to deploy and manage multiple customer organizations through a unified control plane.

## Key Features

### 1. **Multi-Tenant Organization Structure**
- Customers are organized into tier-specific Organizational Units (OUs):
  - `Customers-Healthcare`: HIPAA-aligned customers
  - `Customers-Fintech`: PCI-DSS/SOC2-aligned customers
  - `Customers-Government-Federal`: FedRAMP-aligned customers
  - `Customers-Standard`: Low-compliance customers

### 2. **Customer Tier Model**
Each customer can be configured with a specific tier that determines:
- Compliance framework requirements (HIPAA, SOC2, FedRAMP, CIS)
- Guardrail policies applied
- Feature availability
- Billing tier
- Support level

### 3. **Client Configuration (client.auto.tfvars)**
Clients are defined in `environments/dev/client.auto.tfvars` with the following structure:

```hcl
clients = {
  "client-name" = {
    tier         = "healthcare" | "fintech" | "gov-federal" | "standard"
    account_id   = "AWS_ACCOUNT_ID"
    prefix       = "resource-naming-prefix"
    framework    = "hipaa" | "soc2" | "fedramp" | "cis"
    vpce_id      = "optional-vpc-endpoint-id"
    audit_bucket = "custom-audit-bucket-name"
    tags         = { key = "value" }
  }
}
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│         AWS Organizations (Management Account)       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  Security OU │  │ Shared Svcs  │  │ Workload │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │Healthcare Tier OU│  │Fintech Tier OU   │        │
│  │                  │  │                  │        │
│  │[Client 1]        │  │[Client 2]        │        │
│  │[Client 2]        │  │[Client 3]        │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Gov-Federal OU   │  │Standard Tier OU  │        │
│  │                  │  │                  │        │
│  │[Client 4]        │  │[Client 5]        │        │
│  │                  │  │[Client 6]        │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Deploying Clients

### 1. Add Client to Configuration

Edit `landing-zone/environments/dev/client.auto.tfvars`:

```hcl
clients = {
  "my-new-customer" = {
    tier         = "fintech"
    account_id   = "111122223333"
    prefix       = "customer-short-name"
    framework    = "soc2"
    audit_bucket = "customer-audit-logs"
    tags = {
      Customer = "Customer Inc"
      Tier     = "Fintech"
    }
  }
}
```

### 2. Initialize Terraform

```bash
cd landing-zone/environments/dev
terraform init
```

### 3. Plan Deployment

```bash
terraform plan -out=tfplan
```

### 4. Review Changes

The plan should show:
- New OU creation (if first client of that tier)
- New AWS Account creation for the client
- Guardrail policy attachments

### 5. Apply Configuration

```bash
terraform apply tfplan
```

## Guardrail Policies

Each tier receives tier-specific guardrails:

| Guardrail | Healthcare | Fintech | Gov-Federal | Standard |
|-----------|-----------|---------|-------------|----------|
| Restrict Root User | ✓ | ✓ | ✓ | ✓ |
| Block IAM Users | ✓ | ✓ | ✓ | ✓ |
| Force MFA | ✓ | ✓ | ✓ | ✓ |
| Enable CloudTrail | ✓ | ✓ | ✓ | ✓ |
| Restrict Regions | ✓ | ✓ | ✓ | ✓ |
| VPCE Lockdown | ✓ | - | ✓ | - |
| EBS Encryption | ✓ | ✓ | ✓ | ✓ |
| S3 Encryption | ✓ | ✓ | ✓ | ✓ |

## State Management (S3 Backend)

To use remote state with multi-tenant support, uncomment the backend configuration in `landing-zone/main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "securebase-tf-state-prod"
    key            = "orchestrator/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "securebase-tf-lock"
    encrypt        = true
  }
}
```

**Bootstrap Prerequisites:**
1. Create S3 bucket: `securebase-tf-state-prod`
2. Enable versioning on bucket
3. Create DynamoDB table: `securebase-tf-lock` with primary key `LockID`

## Outputs

After deployment, Terraform outputs include:
- Client account IDs
- OU IDs for each tier
- Audit log bucket names
- CloudTrail ARNs
- Compliance summary

```bash
terraform output
```

## Next Steps: Backend API & Orchestration

To complete the PaaS platform, the following services should be implemented:

1. **Orchestration API**: REST API to manage client deployments
2. **Database**: Multi-tenant database with row-level security
3. **Billing Engine**: Usage metering and invoice generation
4. **Dashboard**: Self-service portal for customers
5. **CI/CD**: Automated testing and deployment pipeline
6. **Observability**: Centralized logging, monitoring, and alerting

See `/workspaces/securebase-app/docs/PAAS_ARCHITECTURE.md` for detailed implementation roadmap.
