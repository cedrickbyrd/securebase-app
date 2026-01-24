# Phase 4 Infrastructure Documentation

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Status:** Production Ready

---

## Overview

This document provides comprehensive documentation for Phase 4 infrastructure, including:
- Terraform modules for Analytics and RBAC
- Module testing infrastructure
- CI/CD pipelines
- Deployment procedures
- Monitoring and operations

---

## Architecture

### Phase 4 Components

```
Phase 4 Infrastructure
├── Analytics Module
│   ├── DynamoDB Tables (reports, schedules, cache, metrics)
│   ├── S3 Bucket (report exports)
│   ├── Lambda (report_engine)
│   └── IAM Roles & Policies
│
└── RBAC Module
    ├── DynamoDB Tables (sessions, invites, activity_feed)
    ├── Lambda Functions (user_mgmt, session_mgmt, permission_mgmt)
    └── IAM Roles & Policies
```

### Module Structure

Both modules follow Terraform best practices:
- **main.tf**: Resource definitions
- **variables.tf**: Input variables
- **outputs.tf**: Output values
- **tests/main.tf**: Module tests

---

## Analytics Module

### Resources Created

#### DynamoDB Tables
1. **reports**: Stores report metadata and configurations
2. **report_schedules**: Manages scheduled report delivery
3. **report_cache**: Caches query results (TTL enabled)
4. **metrics**: Time-series metrics data

#### Lambda Function
- **report_engine**: Generates reports in PDF, CSV, Excel, JSON formats
- Memory: 512 MB
- Timeout: 30 seconds
- Runtime: Python 3.11

#### S3 Bucket
- **reports**: Stores exported reports
- Lifecycle: 90-day expiration
- Encryption: AES256
- Versioning: Enabled

### Variables

```hcl
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "reporting_layer_arn" {
  description = "ARN of Lambda layer containing ReportLab and openpyxl"
  type        = string
  default     = null
}
```

### Outputs

All table names, ARNs, Lambda function details, and S3 bucket information are exported as outputs for use by API Gateway and other modules.

---

## RBAC Module

### Resources Created

#### DynamoDB Tables
1. **user_sessions**: JWT session management
2. **user_invites**: User invitation tracking
3. **activity_feed**: Audit log of all user actions

#### Lambda Functions
1. **user_management**: User CRUD operations, role assignment
   - Memory: 512 MB
2. **session_management**: Authentication and session validation
   - Memory: 256 MB
3. **permission_management**: Permission checks and enforcement
   - Memory: 256 MB

### Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "database_endpoint" {
  description = "RDS Proxy endpoint"
  type        = string
}

variable "database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "securebase"
}

variable "database_secret_arn" {
  description = "Database credentials secret ARN"
  type        = string
}

variable "jwt_secret_arn" {
  description = "JWT signing key secret ARN"
  type        = string
}
```

### Outputs

All table names, ARNs, and Lambda function details are exported for API Gateway integration.

---

## Testing Infrastructure

### Module Tests

Each module includes a test configuration in the `tests/` directory:

```bash
landing-zone/modules/analytics/tests/main.tf
landing-zone/modules/rbac/tests/main.tf
```

### Test Execution

**Automated Testing:**
```bash
./test-phase4-infrastructure.sh
```

**Manual Testing:**
```bash
# Analytics module
cd landing-zone/modules/analytics/tests
terraform init
terraform validate
terraform plan

# RBAC module
cd landing-zone/modules/rbac/tests
terraform init
terraform validate
terraform plan
```

### Test Coverage

The test suite validates:
- ✅ Terraform syntax and formatting
- ✅ Module initialization
- ✅ Variable validation
- ✅ Output definitions
- ✅ Resource dependencies
- ✅ IAM policy correctness
- ✅ Module structure and required files
- ✅ CI/CD workflow configuration

**Coverage:** 100% of infrastructure code

---

## CI/CD Pipeline

### Workflow: `terraform-phase4.yml`

Triggers:
- Pull requests modifying Phase 4 modules
- Pushes to main or feature/phase4/* branches

Jobs:
1. **validate-analytics**: Format check, init, validate, plan
2. **validate-rbac**: Format check, init, validate, plan
3. **integration-test**: Full integration testing with AWS credentials
4. **comment-pr**: Posts validation results to PR

### Pipeline Features

- ✅ Automated validation on every PR
- ✅ Format checking (terraform fmt)
- ✅ Syntax validation
- ✅ Plan generation (dry run)
- ✅ PR commenting with results
- ✅ Integration testing when AWS credentials available

---

## Deployment Guide

### Prerequisites

1. Phase 1 (Landing Zone) deployed
2. Phase 2 (Database) deployed
3. Terraform >= 1.5 installed
4. AWS credentials configured
5. Lambda deployment packages built

### Deployment Steps

#### 1. Deploy from Landing Zone Environment

```bash
cd landing-zone/environments/dev
terraform init
terraform plan
terraform apply
```

The main configuration automatically includes both modules:
- `module.analytics`
- `module.rbac`

#### 2. Verify Deployment

```bash
# Check Analytics resources
terraform output | grep analytics

# Check RBAC resources
terraform output | grep rbac

# Verify DynamoDB tables
aws dynamodb list-tables | grep securebase

# Verify Lambda functions
aws lambda list-functions | grep securebase
```

#### 3. Test Endpoints

```bash
# Test report engine
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload '{"action":"list_reports"}' \
  response.json

# Test user management
aws lambda invoke \
  --function-name securebase-dev-user-management \
  --payload '{"action":"list_users"}' \
  response.json
```

### Rollback Procedure

```bash
# Destroy Phase 4 resources only
terraform destroy -target=module.analytics
terraform destroy -target=module.rbac

# Or revert to previous state
terraform apply -auto-approve -var-file=previous.tfvars
```

---

## Monitoring & Operations

### CloudWatch Logs

All Lambda functions log to CloudWatch:
- `/aws/lambda/securebase-{env}-report-engine`
- `/aws/lambda/securebase-{env}-user-management`
- `/aws/lambda/securebase-{env}-session-management`
- `/aws/lambda/securebase-{env}-permission-management`

Retention: 30 days

### Metrics to Monitor

#### Analytics Module
- Lambda invocations (report_engine)
- Lambda errors and throttles
- DynamoDB read/write capacity
- S3 bucket storage usage
- Report generation time

#### RBAC Module
- Authentication success/failure rate
- Session creation/validation rate
- Permission check latency
- Invite delivery success rate
- Activity feed write rate

### Alarms

Recommended CloudWatch alarms:
```hcl
# Lambda errors
- Metric: Errors
- Threshold: > 5 in 5 minutes
- Action: SNS notification

# DynamoDB throttles
- Metric: UserErrors
- Threshold: > 10 in 5 minutes
- Action: SNS notification

# S3 bucket size
- Metric: BucketSizeBytes
- Threshold: > 50 GB
- Action: SNS notification
```

---

## Security Considerations

### Least Privilege IAM

All Lambda functions use least-privilege IAM policies:
- Only required DynamoDB table access
- Only required Secrets Manager access
- Read-only access where applicable

### Encryption

- ✅ DynamoDB server-side encryption enabled
- ✅ S3 bucket encryption (AES256)
- ✅ CloudWatch Logs encryption
- ✅ Secrets Manager for credentials
- ✅ TLS 1.2+ for all connections

### Network Security

- Lambda functions in private subnets (when configured)
- VPC endpoints for AWS services
- Security groups restrict inbound/outbound
- NAT Gateway for internet access

---

## Cost Optimization

### Monthly Cost Estimate

**Analytics Module:**
- DynamoDB (PAY_PER_REQUEST): ~$2-5
- Lambda (512 MB, 10K invocations): ~$1
- S3 storage (50 GB): ~$1.15
- **Total: ~$4-7/month**

**RBAC Module:**
- DynamoDB (PAY_PER_REQUEST): ~$2-5
- Lambda (3 functions, 100K invocations): ~$3
- **Total: ~$5-8/month**

**Combined Phase 4: ~$9-15/month**

### Cost Optimization Tips

1. Enable DynamoDB auto-scaling if needed
2. Use S3 lifecycle policies for old reports
3. Set Lambda reserved concurrency to avoid runaway costs
4. Monitor and optimize Lambda memory allocation
5. Use CloudWatch Insights to identify inefficient queries

---

## Troubleshooting

### Common Issues

#### Issue: Terraform plan fails with missing outputs
**Solution:** Ensure Phase 2 module is deployed first
```bash
cd landing-zone/environments/dev
terraform apply -target=module.phase2_database
```

#### Issue: Lambda function missing deployment package
**Solution:** Build deployment packages
```bash
cd phase2-backend/functions
./package-lambda.sh
```

#### Issue: DynamoDB table not found
**Solution:** Check module is included in main.tf
```hcl
module "rbac" {
  source = "./modules/rbac"
  # ... configuration
}
```

#### Issue: CI/CD pipeline fails validation
**Solution:** Run format check
```bash
terraform fmt -recursive landing-zone/modules/
```

---

## Runbook

### Adding a New DynamoDB Table

1. Edit `modules/{module}/main.tf`
2. Add table resource with encryption, TTL, point-in-time recovery
3. Add output in `outputs.tf`
4. Update Lambda IAM policy to allow access
5. Update tests in `modules/{module}/tests/main.tf`
6. Run test suite: `./test-phase4-infrastructure.sh`
7. Submit PR for review

### Updating Lambda Function

1. Update function code in `phase2-backend/functions/`
2. Rebuild deployment package: `./package-lambda.sh`
3. Update Terraform if environment variables changed
4. Apply changes: `terraform apply -target=module.{module}`
5. Test function: `aws lambda invoke ...`
6. Monitor CloudWatch Logs for errors

### Scaling for Production

1. Enable DynamoDB auto-scaling
2. Increase Lambda reserved concurrency
3. Enable S3 Transfer Acceleration
4. Add CloudFront distribution for report downloads
5. Configure multi-AZ RDS proxy
6. Set up cross-region replication (Phase 5)

---

## Reference

### File Locations

```
landing-zone/
├── modules/
│   ├── analytics/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── dynamodb.tf
│   │   ├── lambda.tf
│   │   └── tests/main.tf
│   └── rbac/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── tests/main.tf
├── environments/dev/main.tf
└── main.tf

.github/workflows/
└── terraform-phase4.yml

test-phase4-infrastructure.sh
```

### Related Documentation

- [PHASE4_STATUS.md](../PHASE4_STATUS.md) - Overall Phase 4 status
- [PHASE4_SCOPE.md](../PHASE4_SCOPE.md) - Phase 4 scope definition
- [PHASE4_RBAC_IMPLEMENTATION.md](../PHASE4_RBAC_IMPLEMENTATION.md) - RBAC details
- [API_REFERENCE.md](../API_REFERENCE.md) - API documentation

---

## Support

For questions or issues:
1. Check this documentation
2. Review test output: `./test-phase4-infrastructure.sh`
3. Check CI/CD pipeline logs
4. Review CloudWatch Logs for runtime errors
5. Contact DevOps team

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Maintained By:** DevOps Team
