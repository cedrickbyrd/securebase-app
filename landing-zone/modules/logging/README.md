# Audit Log Storage Module

## Overview

This Terraform module provisions SOC 2 Type II compliant audit log storage infrastructure for SecureBase. It creates an S3 bucket with comprehensive security controls to ensure audit logs are protected, immutable, and available for compliance attestation.

## SOC 2 Compliance Mapping

This module implements controls that map to the following SOC 2 Trust Service Criteria:

| Control | Requirement | Implementation |
|---------|------------|----------------|
| **CC6.1** | Logical and Physical Access Controls | AES256 encryption, bucket policies, IAM controls |
| **CC6.6** | Completeness and Accuracy of Processing | Versioning enabled, Object Lock retention |
| **CC7.2** | System Monitoring | CloudTrail logging, log file validation |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ AWS Organization                                         │
│  ├─ All Member Accounts                                 │
│  │   └─ API Activity                                    │
│  │                                                       │
│  └─ Management Account                                  │
│      └─ CloudTrail (Organization Trail)                 │
│           │                                              │
│           ▼                                              │
│      ┌─────────────────────────────┐                   │
│      │ S3 Bucket: Audit Logs       │                   │
│      ├─────────────────────────────┤                   │
│      │ • Object Lock: GOVERNANCE   │                   │
│      │ • Retention: 365 days       │                   │
│      │ • Versioning: Enabled       │                   │
│      │ • Encryption: AES256        │                   │
│      │ • Lifecycle: prevent_destroy│                   │
│      └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Security Features

### 1. Object Lock (WORM Protection)

**Mode**: GOVERNANCE  
**Retention**: 365 days

Object Lock provides Write-Once-Read-Many (WORM) protection, ensuring audit logs cannot be modified or deleted during the retention period. GOVERNANCE mode allows authorized administrators with `s3:BypassGovernanceRetention` permission to override retention if necessary (e.g., legal discovery, incident response).

**Why GOVERNANCE vs COMPLIANCE?**
- **GOVERNANCE**: Suitable for SOC 2, provides operational flexibility
- **COMPLIANCE**: Strictest mode, used for SEC Rule 17a-4, FINRA requirements

### 2. Versioning

All object modifications are preserved through S3 versioning. This ensures:
- Complete audit trail of all log file changes
- Protection against accidental overwrites
- Ability to recover from unintended deletions (within retention period)

### 3. Encryption at Rest

**Algorithm**: AES256 (SSE-S3)  
All audit logs are encrypted using AWS-managed encryption keys. For enhanced security requirements (HIPAA, FedRAMP), consider upgrading to KMS-managed keys (SSE-KMS).

### 4. Lifecycle Protection

The `prevent_destroy` lifecycle block ensures the bucket cannot be destroyed through Terraform without explicit manual override. This prevents accidental deletion of critical audit evidence.

### 5. CloudTrail Integration

Organization-wide CloudTrail captures all API activity across member accounts and writes logs to this bucket. Features include:
- Multi-region trail for global coverage
- Log file integrity validation using digital signatures
- Global service events (IAM, STS, CloudFront)

## Outputs

### `central_log_bucket_name`
The S3 bucket name for integration with other resources.

### `log_protection_evidence`
Comprehensive attestation data for SOC 2 auditors, including:
- Bucket identification (ID, ARN, name)
- Object Lock configuration (mode, retention period)
- Versioning status
- Encryption settings
- Lifecycle protection status
- Compliance framework mappings
- Timestamp of attestation

**Usage Example**:
```hcl
output "soc2_evidence" {
  value = module.central_logging.log_protection_evidence
}
```

**Sample Output**:
```json
{
  "bucket_id": "securebase-audit-logs-dev",
  "bucket_arn": "arn:aws:s3:::securebase-audit-logs-dev",
  "object_lock_enabled": true,
  "object_lock_mode": "GOVERNANCE",
  "retention_days": 365,
  "versioning_enabled": true,
  "encryption_algorithm": "AES256",
  "compliance_frameworks": ["SOC2-Type-II", "CC6.1", "CC6.6", "CC7.2"]
}
```

## Variables

### Required Variables
- `environment` (string): Environment name (e.g., dev, staging, prod)

### Optional Variables
- `log_retention_days` (number): CloudWatch log retention period. Default: 365 days

## Multi-Tenant Architecture

This module uses **environment-based naming** (`securebase-audit-logs-${var.environment}`) rather than client-based naming. This design decision supports the SecureBase multi-tenant architecture:

### Why Environment-Based?
1. **Centralized Audit Logging**: Single audit bucket per environment consolidates all customer logs
2. **Organization Trail**: CloudTrail captures activity across all customer accounts
3. **Simplified Management**: One bucket to secure, monitor, and backup
4. **Cost Efficiency**: Reduced per-bucket overhead charges
5. **Cross-Customer Analytics**: Enables security analytics across all tenants

### Client Isolation
Despite centralized storage, client data is isolated through:
- **Prefix-based organization**: Logs stored with account ID prefixes (`/AWSLogs/{account-id}/...`)
- **IAM policies**: Customer accounts can only access their own log prefixes
- **Bucket policies**: CloudTrail-only write access prevents unauthorized modifications

### Custom Client Buckets
For customers requiring dedicated audit buckets (e.g., regulatory requirements), use the `audit_bucket` variable in client configuration:

```hcl
clients = {
  "acme-healthcare" = {
    tier         = "healthcare"
    framework    = "hipaa"
    audit_bucket = "acme-hipaa-audit-logs"  # Custom bucket name
    # ... other config
  }
}
```

## Deployment

### Prerequisites
1. AWS Organizations must be configured
2. CloudTrail must have permissions to write to S3
3. Terraform state backend configured for environment

### Deployment Steps

**From environment directory** (e.g., `landing-zone/environments/dev/`):

```bash
# Initialize Terraform
terraform init

# Review changes
terraform plan

# Deploy infrastructure
terraform apply

# View SOC 2 attestation evidence
terraform output log_protection_evidence
```

⚠️ **Important**: Always run Terraform from the environment directory, not from the module directory or repository root.

## Maintenance

### Viewing Logs
```bash
# List log files
aws s3 ls s3://securebase-audit-logs-dev/AWSLogs/ --recursive

# Download specific log file (requires s3:GetObject permission)
aws s3 cp s3://securebase-audit-logs-dev/AWSLogs/123456789012/CloudTrail/us-east-1/2024/01/01/file.json.gz .
```

### Emergency Access
In case of emergency requiring log deletion before retention expires:

```bash
# Requires s3:BypassGovernanceRetention permission
aws s3api delete-object \
  --bucket securebase-audit-logs-dev \
  --key AWSLogs/123456789012/CloudTrail/us-east-1/2024/01/01/file.json.gz \
  --bypass-governance-retention
```

### Monitoring
Key CloudWatch metrics to monitor:
- `NumberOfObjects`: Track bucket growth
- `BucketSizeBytes`: Monitor storage costs
- CloudTrail delivery failures: `DeliveryFailed` metric

## Troubleshooting

### Issue: CloudTrail not writing logs
**Symptoms**: No logs appearing in S3 bucket  
**Solutions**:
1. Verify bucket policy allows CloudTrail write access
2. Check CloudTrail is enabled and configured with correct bucket name
3. Review CloudTrail console for delivery errors

### Issue: Access denied when retrieving logs
**Symptoms**: S3 access denied errors  
**Solutions**:
1. Verify IAM principal has `s3:GetObject` permission
2. Check bucket policy doesn't explicitly deny access
3. Ensure Object Lock hasn't expired (within retention period)

### Issue: Cannot destroy bucket
**Symptoms**: Terraform destroy fails  
**Solutions**:
1. This is by design due to `prevent_destroy` lifecycle block
2. To destroy: manually remove lifecycle block, then run `terraform destroy`
3. For production: Never destroy audit buckets; archive instead

## Auditor Guidance

### Evidence Collection
Auditors reviewing SOC 2 Type II compliance should collect:

1. **Terraform Configuration**: Review `main.tf` for security controls
2. **Attestation Output**: Run `terraform output log_protection_evidence`
3. **AWS Console Verification**:
   - S3 bucket properties: Object Lock, versioning, encryption
   - CloudTrail: Trail configuration, log file validation
   - IAM: Bucket policies, access controls
4. **Sample Log Files**: Download and verify log integrity

### Test Procedures
Recommended tests:
- [ ] Verify Object Lock is enabled with correct mode and retention
- [ ] Confirm versioning is enabled
- [ ] Validate encryption settings (AES256 or KMS)
- [ ] Test unauthorized deletion attempts (should be denied)
- [ ] Review CloudTrail logs for completeness
- [ ] Verify log file integrity validation

### Compliance Period
Logs are retained for **365 days** in immutable storage, covering the minimum 1-year period required for most SOC 2 audits.

## References

- [AWS S3 Object Lock Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [SOC 2 Trust Service Criteria](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome.html)
- [AWS CloudTrail Best Practices](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [SecureBase Architecture Documentation](../../../docs/PAAS_ARCHITECTURE.md)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-02-01 | Updated to SOC 2 compliant configuration with GOVERNANCE mode, added comprehensive documentation and attestation output |
| 1.0.0 | 2025-12-01 | Initial release with COMPLIANCE mode Object Lock |

## Support

For questions or issues related to this module:
- **Internal**: Contact SecureBase Platform Team
- **Security Concerns**: security@securebase.com
- **Audit Requests**: compliance@securebase.com
