# SOC 2 Attestation Output - Example

This document shows the expected output format for the `log_protection_evidence` Terraform output, which provides comprehensive evidence for SOC 2 Type II auditors.

## Viewing the Attestation

After deploying the infrastructure, auditors can retrieve the attestation evidence using:

```bash
cd landing-zone/environments/dev
terraform output log_protection_evidence
```

Or to export as JSON:

```bash
terraform output -json log_protection_evidence > soc2_attestation.json
```

## Expected Output Format

### Development Environment Example

```json
{
  "attestation_timestamp": "2026-02-01T15:30:00Z",
  "bucket_arn": "arn:aws:s3:::securebase-audit-logs-dev",
  "bucket_id": "securebase-audit-logs-dev",
  "bucket_name": "securebase-audit-logs-dev",
  "compliance_frameworks": [
    "SOC2-Type-II",
    "CC6.1",
    "CC6.6",
    "CC7.2"
  ],
  "encryption_algorithm": "AES256",
  "encryption_type": "SSE-S3",
  "force_destroy_disabled": true,
  "object_lock_enabled": true,
  "object_lock_mode": "GOVERNANCE",
  "prevent_destroy_enabled": true,
  "retention_days": 365,
  "versioning_enabled": true
}
```

### Production Environment Example

```json
{
  "attestation_timestamp": "2026-02-01T15:30:00Z",
  "bucket_arn": "arn:aws:s3:::securebase-audit-logs-prod",
  "bucket_id": "securebase-audit-logs-prod",
  "bucket_name": "securebase-audit-logs-prod",
  "compliance_frameworks": [
    "SOC2-Type-II",
    "CC6.1",
    "CC6.6",
    "CC7.2"
  ],
  "encryption_algorithm": "AES256",
  "encryption_type": "SSE-S3",
  "force_destroy_disabled": true,
  "object_lock_enabled": true,
  "object_lock_mode": "GOVERNANCE",
  "prevent_destroy_enabled": true,
  "retention_days": 365,
  "versioning_enabled": true
}
```

## Field Descriptions

| Field | Description | SOC 2 Relevance |
|-------|-------------|-----------------|
| `bucket_id` | S3 bucket identifier | Unique identifier for audit verification |
| `bucket_arn` | AWS Resource Name | Complete resource path for access control review |
| `bucket_name` | Human-readable name | Easy identification in audit reports |
| `object_lock_enabled` | Object Lock status | Confirms WORM protection is active (CC7.2) |
| `object_lock_mode` | Lock mode (GOVERNANCE) | Shows retention enforcement level |
| `retention_days` | Retention period | Confirms 365-day retention requirement |
| `versioning_enabled` | Versioning status | Confirms audit trail completeness (CC6.6) |
| `encryption_algorithm` | Encryption method | Shows data confidentiality protection (CC6.1) |
| `encryption_type` | Key management | Identifies encryption key source |
| `prevent_destroy_enabled` | Lifecycle protection | Confirms deletion prevention |
| `force_destroy_disabled` | Force destroy status | Ensures bucket safety |
| `compliance_frameworks` | Applicable frameworks | Lists all compliance standards met |
| `attestation_timestamp` | Evidence generation time | Timestamp for audit trail |

## Using in SOC 2 Reports

### Control Testing Evidence

Include the attestation output in SOC 2 Type II reports as evidence for:

1. **CC6.1 - Logical and Physical Access Controls**
   - Evidence: `encryption_algorithm: "AES256"`, `encryption_type: "SSE-S3"`
   - Control: Data at rest is encrypted using industry-standard algorithms

2. **CC6.6 - Completeness and Accuracy of Processing**
   - Evidence: `versioning_enabled: true`, `object_lock_mode: "GOVERNANCE"`
   - Control: All audit log modifications are tracked and protected

3. **CC7.2 - System Monitoring**
   - Evidence: `object_lock_enabled: true`, `retention_days: 365`
   - Control: Audit logs are immutably retained for 1 year minimum

### Sample Audit Test

**Control**: Audit logs are protected from unauthorized modification or deletion

**Test Procedure**:
1. Retrieve `log_protection_evidence` output from Terraform
2. Verify `object_lock_enabled` is `true`
3. Verify `object_lock_mode` is `GOVERNANCE` or `COMPLIANCE`
4. Verify `retention_days` is >= 365
5. Verify `versioning_enabled` is `true`
6. Verify `encryption_algorithm` is `AES256` or stronger
7. Verify `prevent_destroy_enabled` is `true`

**Expected Result**: All checks pass  
**Actual Result**: [Insert attestation output]  
**Status**: ✅ Pass

## Automated Compliance Verification

You can use the attestation output for automated compliance checks:

```bash
#!/bin/bash
# verify_soc2_compliance.sh

ATTESTATION=$(terraform output -json log_protection_evidence)

# Check Object Lock
if [[ $(echo $ATTESTATION | jq -r '.object_lock_enabled') != "true" ]]; then
  echo "❌ FAIL: Object Lock not enabled"
  exit 1
fi

# Check retention period
RETENTION=$(echo $ATTESTATION | jq -r '.retention_days')
if [[ $RETENTION -lt 365 ]]; then
  echo "❌ FAIL: Retention period less than 365 days (found: $RETENTION)"
  exit 1
fi

# Check versioning
if [[ $(echo $ATTESTATION | jq -r '.versioning_enabled') != "true" ]]; then
  echo "❌ FAIL: Versioning not enabled"
  exit 1
fi

# Check encryption
if [[ $(echo $ATTESTATION | jq -r '.encryption_algorithm') != "AES256" ]]; then
  echo "❌ FAIL: Encryption not AES256"
  exit 1
fi

# Check lifecycle protection
if [[ $(echo $ATTESTATION | jq -r '.prevent_destroy_enabled') != "true" ]]; then
  echo "❌ FAIL: Prevent destroy not enabled"
  exit 1
fi

echo "✅ PASS: All SOC 2 compliance checks passed"
echo ""
echo "Attestation timestamp: $(echo $ATTESTATION | jq -r '.attestation_timestamp')"
echo "Bucket: $(echo $ATTESTATION | jq -r '.bucket_name')"
echo "Mode: $(echo $ATTESTATION | jq -r '.object_lock_mode')"
echo "Retention: $(echo $ATTESTATION | jq -r '.retention_days') days"
```

## Integration with Audit Tools

The attestation output can be integrated with compliance management platforms:

### Export to CSV for spreadsheet tools
```bash
terraform output -json log_protection_evidence | \
  jq -r '[.bucket_name, .object_lock_mode, .retention_days, .versioning_enabled, .encryption_algorithm] | @csv'
```

### Export for compliance platforms (e.g., Vanta, Drata)
```bash
terraform output -json log_protection_evidence > attestation.json
# Upload attestation.json to compliance platform
```

### Include in CI/CD pipeline
```yaml
# .github/workflows/compliance-check.yml
- name: Verify SOC 2 Compliance
  run: |
    cd landing-zone/environments/prod
    terraform output -json log_protection_evidence > /tmp/attestation.json
    # Upload to artifact storage
    aws s3 cp /tmp/attestation.json s3://compliance-evidence/soc2/$(date +%Y-%m-%d)/
```

## Annual Attestation Workflow

1. **Q1**: Deploy infrastructure with Terraform
2. **Q2**: Retrieve attestation output for auditor review
3. **Q3**: Include in SOC 2 Type II report as evidence
4. **Q4**: Update attestation for annual compliance cycle

## Compliance Period Tracking

The `attestation_timestamp` field provides evidence of when the configuration was verified:

```json
"attestation_timestamp": "2026-02-01T15:30:00Z"
```

This timestamp:
- Documents when the security controls were in place
- Supports continuous compliance monitoring
- Provides audit trail for configuration changes
- Can be compared across reporting periods

## Security Notice

⚠️ **Important**: The attestation output contains infrastructure configuration details. While it doesn't include credentials, limit distribution to:
- Internal compliance teams
- External auditors (during SOC 2 examination)
- Authorized security personnel

Do not publish attestation outputs in public repositories or unsecured locations.

## Support

For questions about the attestation output:
- **Technical**: Platform Team
- **Compliance**: compliance@securebase.com
- **Security**: security@securebase.com

## References

- [SOC 2 Attestation Output Documentation](landing-zone/modules/logging/outputs.tf)
- [Logging Module README](landing-zone/modules/logging/README.md)
- [Implementation Summary](SOC2_AUDIT_LOG_IMPLEMENTATION.md)
