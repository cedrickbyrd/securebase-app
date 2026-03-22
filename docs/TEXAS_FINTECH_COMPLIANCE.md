# Texas State Banking Examiner Compliance Collector

## Overview

The Texas Fintech Compliance Collector is a specialized Lambda function that collects transaction-level evidence required by the Texas Department of Banking and FinCEN (Financial Crimes Enforcement Network) for money transmitter license holders and Digital Asset Service Providers (DASPs).

This implementation addresses critical compliance requirements for financial technology companies operating in Texas, with specific focus on Bank Secrecy Act (BSA) and Anti-Money Laundering (AML) regulations.

## Regulatory Framework

### Primary Regulations

1. **7 Tex. Admin. Code §33.35** - Transaction Recordkeeping
   - Money transmitters must maintain detailed transaction records
   - Records must be available for state banking examiners
   - 5-year retention requirement

2. **31 CFR §1010.410(e)** - FinCEN Recordkeeping Requirements
   - Customer identification information
   - Transaction amounts, dates, and methods
   - Sender and recipient details
   - Employee processing information

3. **31 CFR §1022.210** - Customer Identification Program (CIP)
   - Name, address, date of birth, TIN/SSN
   - Government-issued ID verification
   - Risk-based verification procedures

4. **HB 1666** - Digital Asset Service Provider (DASP) Requirements
   - Customer fund segregation (500+ TX customers or $10M+ funds)
   - Prohibition on commingling customer and company funds
   - Reserve adequacy requirements

## Compliance Controls Implemented

### TX-MT-R1: Transaction Recordkeeping
**Purpose**: Verify that all transactions have complete required fields per 31 CFR §1010.410(e)

**Evidence Collected**:
- Customer name, address, identification
- Transaction timestamp (to the second)
- Transaction amount and currency
- Payment method
- Fee charged
- Recipient information (for transmissions)
- Processing employee
- Receipt number

**Compliance Threshold**: >95% of sampled transactions must have all required fields

### TX-MT-R2: CTR/SAR Filing Evidence
**Purpose**: Verify Currency Transaction Reports and Suspicious Activity Reports are filed timely

**Evidence Collected**:
- **CTR Compliance**: All transactions >$10,000 must have CTR filed within 15 calendar days
- **SAR Compliance**: Suspicious activity must be detected and reported within 30 calendar days
- **Structuring Detection**: Identifies patterns of transactions just below $10K threshold (potential structuring)

**Red Flags**:
- Multiple transactions between $8,000-$9,999 by same customer
- Frequent just-under-threshold transactions
- Unusual transaction patterns

### TX-MT-R3: Customer Identification Program (CIP)
**Purpose**: Verify customer due diligence is performed per FinCEN requirements

**Evidence Collected**:
- Customer name, DOB, SSN/TIN
- Government ID verification (type, number, issuer, expiration)
- Verification date and method
- Risk rating assignment
- Customer Due Diligence (CDD) completion
- Enhanced Due Diligence (EDD) for high-risk customers
- PEP (Politically Exposed Person) screening
- Sanctions list screening (OFAC)

**Compliance Requirements**:
- All active customers must have verified ID
- High-risk customers must have completed EDD
- Annual re-verification for ongoing customers

### TX-MT-R4: Authorized Delegate Oversight
**Purpose**: Verify oversight of authorized delegates per 7 TAC §33.35(b)(3)

**Evidence Collected**:
- Delegate agreements (current/expired)
- Location count
- Last audit date
- 30-day transaction volume
- Compliance status

**Compliance Requirements**:
- Signed delegate agreement (renewed annually)
- Annual compliance audit
- Transaction monitoring

### TX-DASP-R1: Digital Asset Fund Segregation
**Purpose**: Verify compliance with HB 1666 for Digital Asset Service Providers

**Evidence Collected**:
- Texas customer count
- Customer fund balances (hot/cold wallets)
- Company operational fund balances
- Commingling detection
- Reserve adequacy ratio

**Compliance Requirements**:
- No commingling of customer and company funds
- Reserves >= 100% of customer obligations
- Applies if: 500+ TX customers OR $10M+ customer funds

## Database Schema

### New Tables Added (Migration 005)

#### fintech_transactions
Stores detailed transaction records per 31 CFR §1010.410(e)
- Transaction details (timestamp, type, amount, currency, fee)
- Sender information (name, address, SSN, ID verification)
- Recipient information (name, address, bank, account)
- Processing details (employee, receipt number, location)
- Compliance flags (CTR eligible, suspicious activity, structuring risk)

#### fintech_customer_details
Extended KYC/CIP data per 31 CFR §1022.210
- Customer identification (name, DOB, SSN, address)
- Government ID verification
- Risk assessment (rating, CDD, EDD)
- Screening (PEP, sanctions)
- Account status

#### ctr_filings
Currency Transaction Reports (FinCEN Form 112)
- Filing details (date, BSA E-Filing number, status)
- Transaction reference
- Compliance tracking (deadline, days to file, on-time indicator)

#### sar_filings
Suspicious Activity Reports (FinCEN Form 111)
- Detection and filing dates
- Activity type and narrative
- Total amount involved
- Compliance tracking (30-day deadline)

#### sar_transactions
Many-to-many relationship between SARs and transactions

#### authorized_delegates
Authorized delegate oversight per 7 TAC §33.35(b)(3)
- Delegate details (name, EIN, locations)
- Agreement dates
- Audit tracking
- Compliance status

#### delegate_transactions
Transaction activity by authorized delegates

#### digital_asset_accounts
For Digital Asset Service Providers (HB 1666)
- Account details (type, balances)
- State tracking
- Segregation compliance flags

#### company_accounts
Company operational funds (separate from customer funds)

## Lambda Function

### Function Name
`texas_fintech_compliance_collector`

### Handler
`texas_fintech_compliance_collector.lambda_handler`

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `RDS_ENDPOINT` | Aurora PostgreSQL endpoint | `securebase-prod.cluster-xxx.rds.amazonaws.com` |
| `RDS_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `securebase` |
| `RDS_SECRET_ARN` | Secrets Manager ARN for DB credentials | `arn:aws:secretsmanager:us-east-1:...` |
| `EVIDENCE_BUCKET` | S3 bucket for evidence storage | `securebase-compliance-evidence` |

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:securebase/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::securebase-compliance-evidence/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

### Event Format

```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "controls": [
    "TX-MT-R1",
    "TX-MT-R2",
    "TX-MT-R3",
    "TX-MT-R4",
    "TX-DASP-R1"
  ],
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "sample_size": 100
}
```

**Parameters**:
- `customer_id` (required): UUID of the fintech customer
- `controls` (optional): Array of control IDs to collect. Default: all controls
- `start_date` (optional): Start of audit period. Default: 90 days ago
- `end_date` (optional): End of audit period. Default: today
- `sample_size` (optional): Number of records to sample. Default: 100

### Response Format

```json
{
  "statusCode": 200,
  "body": {
    "customer_id": "550e8400-e29b-41d4-a716-446655440000",
    "collection_date": "2024-03-21T19:45:00Z",
    "audit_period": {
      "start_date": "2024-01-01T00:00:00",
      "end_date": "2024-03-31T23:59:59"
    },
    "controls_collected": 5,
    "controls_failed": 0,
    "evidence": {
      "TX-MT-R1": {
        "status": "success",
        "s3_uri": "s3://securebase-compliance-evidence/customer-uuid/texas-fintech/TX-MT-R1/20240321-194500.json",
        "summary": {
          "description": "Transaction recordkeeping - 7 TAC §33.35",
          "collection_timestamp": "2024-03-21T19:45:00Z"
        }
      }
    },
    "s3_refs": {
      "TX-MT-R1": "s3://securebase-compliance-evidence/...",
      "TX-MT-R2": "s3://securebase-compliance-evidence/...",
      "TX-MT-R3": "s3://securebase-compliance-evidence/...",
      "TX-MT-R4": "s3://securebase-compliance-evidence/...",
      "TX-DASP-R1": "s3://securebase-compliance-evidence/..."
    }
  }
}
```

## Deployment

### 1. Apply Database Migration

```bash
cd phase2-backend/database
psql -h <RDS_ENDPOINT> -U <DB_USER> -d securebase -f migrations/005_texas_fintech_compliance.sql
```

### 2. Package Lambda Function

```bash
cd phase2-backend/functions
chmod +x package-lambda.sh
./package-lambda.sh texas_fintech_compliance_collector
```

### 3. Deploy Lambda via Terraform

Add to `landing-zone/modules/phase2-backend/main.tf`:

```hcl
resource "aws_lambda_function" "texas_fintech_compliance" {
  function_name = "${var.environment}-texas-fintech-compliance"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "texas_fintech_compliance_collector.lambda_handler"
  runtime       = "python3.11"
  timeout       = 300
  memory_size   = 512
  
  filename         = "../../phase2-backend/deploy/texas_fintech_compliance_collector.zip"
  source_code_hash = filebase64sha256("../../phase2-backend/deploy/texas_fintech_compliance_collector.zip")
  
  environment {
    variables = {
      RDS_ENDPOINT      = aws_db_instance.postgres.endpoint
      RDS_PORT          = "5432"
      DB_NAME           = "securebase"
      RDS_SECRET_ARN    = aws_secretsmanager_secret.rds_credentials.arn
      EVIDENCE_BUCKET   = aws_s3_bucket.compliance_evidence.id
    }
  }
  
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }
  
  layers = [aws_lambda_layer_version.db_layer.arn]
}

# EventBridge rule for monthly collection
resource "aws_cloudwatch_event_rule" "monthly_compliance" {
  name                = "${var.environment}-monthly-texas-compliance"
  description         = "Trigger Texas compliance collection monthly"
  schedule_expression = "cron(0 0 1 * ? *)"  # 1st of month at midnight
}

resource "aws_cloudwatch_event_target" "compliance_lambda" {
  rule      = aws_cloudwatch_event_rule.monthly_compliance.name
  target_id = "TexasComplianceLambda"
  arn       = aws_lambda_function.texas_fintech_compliance.arn
}
```

## Testing

### Unit Tests

```bash
cd phase2-backend/functions
pytest test_texas_fintech_compliance_collector.py -v
```

### Integration Test

```bash
# Create test event
cat > test-event.json <<EOF
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "controls": ["TX-MT-R1"],
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "sample_size": 10
}
EOF

# Invoke Lambda
aws lambda invoke \
  --function-name dev-texas-fintech-compliance \
  --payload file://test-event.json \
  --cli-binary-format raw-in-base64-out \
  response.json

# View response
cat response.json | jq .
```

## Evidence Storage

Evidence is stored in S3 with the following structure:

```
s3://securebase-compliance-evidence/
├── {customer_id}/
│   └── texas-fintech/
│       ├── TX-MT-R1/
│       │   └── 20240321-194500.json
│       ├── TX-MT-R2/
│       │   └── 20240321-194530.json
│       ├── TX-MT-R3/
│       │   └── 20240321-194600.json
│       ├── TX-MT-R4/
│       │   └── 20240321-194630.json
│       └── TX-DASP-R1/
│           └── 20240321-194700.json
```

**S3 Bucket Configuration**:
- Server-Side Encryption (AES-256)
- Versioning enabled
- Object Lock (Compliance Mode, 7-year retention)
- Lifecycle policy: Archive to Glacier after 90 days
- Access logging enabled

## Monitoring & Alerts

### CloudWatch Metrics

- `TexasCompliance/ControlsCollected` - Number of controls successfully collected
- `TexasCompliance/ControlsFailed` - Number of controls that failed
- `TexasCompliance/CTRComplianceRate` - Percentage of CTRs filed on time
- `TexasCompliance/SARComplianceRate` - Percentage of SARs filed on time
- `TexasCompliance/StructuringCasesDetected` - Number of potential structuring cases

### CloudWatch Alarms

1. **CTR Compliance Below 95%**
   - Trigger SNS notification to compliance team
   - Escalate to Texas Department of Banking if <90%

2. **Structuring Cases Detected**
   - Immediate notification to AML officer
   - Automatic SAR filing workflow initiation

3. **Lambda Execution Failures**
   - Alert DevOps team
   - Retry with exponential backoff

## Operational Procedures

### Monthly Compliance Workflow

1. **1st of Month**: Lambda automatically triggered by EventBridge
2. **Evidence Collection**: Lambda collects evidence for all fintech customers
3. **S3 Storage**: Evidence stored in encrypted S3 bucket
4. **Compliance Review**: Compliance team reviews evidence within 5 business days
5. **Exception Handling**: Non-compliant items escalated to remediation workflow
6. **Examiner Access**: Evidence available for state banking examiners on request

### State Banking Examiner Request Process

1. **Receive Examiner Request**: Formal request from Texas DOB
2. **Pull Evidence**: Retrieve evidence from S3 for requested period
3. **Generate Report**: Create examiner-friendly report (PDF/Excel)
4. **Secure Transfer**: Provide via secure file transfer (SFTP/portal)
5. **Log Access**: Audit log all examiner access

### Remediation Workflow

If compliance gaps are identified:

1. **Identify Root Cause**: Transaction system issue vs. process gap
2. **Backfill Missing Data**: Update transaction records with missing fields
3. **File Overdue CTR/SAR**: Submit late filings to FinCEN
4. **Process Improvement**: Update transaction capture process
5. **Re-Collect Evidence**: Run collector again to verify remediation

## Security Considerations

### Data Protection

- **Encryption at Rest**: All PII encrypted in PostgreSQL (SSN, account numbers)
- **Encryption in Transit**: TLS 1.2+ for all database connections
- **Row-Level Security**: Multi-tenant isolation via PostgreSQL RLS
- **Audit Logging**: All evidence access logged to immutable audit trail

### Access Control

- **Lambda IAM Role**: Principle of least privilege
- **Database Credentials**: Rotated automatically via Secrets Manager
- **S3 Bucket Policy**: Restrict access to compliance team and examiners
- **MFA Required**: All human access to evidence requires MFA

### Compliance Chain of Custody

- **SHA-256 Hashing**: All evidence files hashed for integrity verification
- **S3 Object Lock**: Evidence immutable for 7 years (FinCEN requirement)
- **Version Control**: S3 versioning tracks any access/modification
- **Audit Trail**: CloudTrail logs all S3 access

## Troubleshooting

### Common Issues

**Issue**: Lambda timeout after 15 minutes
**Solution**: Reduce sample_size or collect controls individually

**Issue**: Database connection failures
**Solution**: Check RDS security group, verify Lambda in VPC

**Issue**: Missing transaction data
**Solution**: Verify fintech_transactions table is populated, check texas_nexus flag

**Issue**: CTR compliance rate showing 0%
**Solution**: Check ctr_filings table has data, verify days_to_file calculation

## References

### Regulatory Guidance

- [Texas Administrative Code Title 7, Part 3, Chapter 33](https://www.banking.texas.gov/page/rules-regulations)
- [FinCEN Money Services Business Regulations](https://www.fincen.gov/resources/statutes-and-regulations)
- [31 CFR Part 1022 - Money Services Businesses](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022)
- [Texas HB 1666 - Digital Asset Regulation](https://capitol.texas.gov/tlodocs/87R/billtext/html/HB01666F.htm)

### FinCEN Forms

- [FinCEN Form 112 - Currency Transaction Report (CTR)](https://www.fincen.gov/sites/default/files/shared/CTR.pdf)
- [FinCEN Form 111 - Suspicious Activity Report (SAR)](https://www.fincen.gov/sites/default/files/shared/FinCEN_SAR_ElectronicFilingRequirements.pdf)

### Best Practices

- [FFIEC BSA/AML Examination Manual](https://bsaaml.ffiec.gov/manual)
- [FinCEN Guidance on Suspicious Activity Reporting](https://www.fincen.gov/resources/advisories)

## Support

For technical support:
- Email: compliance-tech@securebase.io
- Slack: #texas-fintech-compliance
- On-call: PagerDuty rotation

For regulatory questions:
- Contact: Chief Compliance Officer
- Email: cco@securebase.io
- Phone: +1 (512) 555-0199
# Texas Fintech Compliance — Integration & Deployment Guide

SecureBase's **Texas Fintech Compliance** module automates evidence collection
for licensed Texas money transmitters and digital asset service providers (DASPs)
facing Texas Department of Banking (DOB) examinations.

---

## Applicable Tiers

| Tier | Monthly Price | Controls |
|---|---|---|
| **Fintech Pro** | $7,500/mo | TX-MT-R1 through TX-MT-R4 |
| **Fintech Elite** | $12,000/mo | TX-MT-R1 through TX-DASP-R1 + multi-state |

---

## Controls Implemented

| Control ID | Name | Regulation |
|---|---|---|
| TX-MT-R1 | Transaction Recordkeeping | 7 TAC §33.35; Fin. Code §151.307 |
| TX-MT-R2a | Currency Transaction Reports (CTR) | 31 CFR §1022.310 |
| TX-MT-R2b | Suspicious Activity Reports (SAR) | 31 CFR §1022.320 |
| TX-MT-R3 | Customer Identification Program (CIP) | 31 CFR §1022.210; 7 TAC §33.3 |
| TX-MT-R4 | Digital Asset Segregation | TX HB 1666; Fin. Code §152 |
| TX-DASP-R1 | DASP Licence Compliance | TX Fin. Code §152.101 |

---

## Architecture

```
Customer DB ──► Lambda (texas_fintech_compliance_collector)
                  │
                  ├─► SHA-256 hash each evidence record
                  ├─► KMS sign the hash (non-repudiation)
                  ├─► Vault to S3 (Object Lock / Compliance mode)
                  └─► Write to Aurora (tx_* tables + tx_evidence_signatures)
                              │
                              └─► Portal (Examiner Export API)
```

---

## Database Migration

Run migration `005` after the core schema is applied:

```bash
cd phase2-backend/database
psql $DATABASE_URL -f migrations/005_texas_fintech_compliance.sql
```

Tables created:

- `tx_transaction_records` — 7 TAC §33.35 transaction records (5-year retention)
- `tx_ctr_filings` — CTR filings (31 CFR §1022.310)
- `tx_sar_filings` — SAR filings (31 CFR §1022.320)
- `tx_cip_records` — Customer Identification Program records
- `tx_digital_asset_wallets` — HB 1666 digital asset segregation
- `tx_aml_alerts` — AML system alert log
- `tx_examiner_exports` — Audit trail of examiner data packages
- `tx_compliance_controls` — Per-customer control status
- `tx_evidence_signatures` — KMS-signed evidence manifests

All tables enforce Row-Level Security using `app.current_customer_id`.

---

## Lambda Function

**File:** `phase2-backend/functions/texas_fintech_compliance_collector.py`

### Environment Variables

| Variable | Description |
|---|---|
| `RDS_HOST` | Aurora Proxy endpoint |
| `RDS_DATABASE` | Database name (default: `securebase`) |
| `RDS_USER` | Database user |
| `RDS_SECRET_ARN` | Secrets Manager ARN containing DB password |
| `KMS_KEY_ID` | KMS key ARN/ID for evidence signing |
| `S3_EVIDENCE_BUCKET` | S3 bucket with Object Lock enabled |
| `ENVIRONMENT` | `dev` / `staging` / `prod` |

### Invocation Modes

**Scheduled (EventBridge cron — daily):**

```json
{ "source": "aws.events" }
```

Collects evidence for all `fintech_pro` and `fintech_elite` customers.

**On-demand collection (API Gateway POST):**

```bash
POST /fintech/collect
{
  "customer_id": "uuid",
  "controls": ["TX-MT-R1", "TX-MT-R2a"]   // omit for all controls
}
```

**Examiner export package (API Gateway POST):**

```bash
POST /fintech/examiner-export
{
  "customer_id": "uuid",
  "period_start": "2025-01-01",
  "period_end":   "2025-03-31",
  "examiner_name":  "Jane Smith",
  "examiner_email": "jsmith@dob.texas.gov"
}
```

Response:

```json
{
  "export_reference": "TX-EXAM-PROD-20250401120000-A1B2C3D4",
  "s3_key": "evidence/prod/uuid/examiner_export/...",
  "package_hash": "sha256hex...",
  "record_counts": { "transactions": 1200, "ctr_filings": 3, "sar_filings": 1 }
}
```

---

## Packaging & Deployment

```bash
# Add psycopg2-binary to Lambda Layer (already in lambda_layer/)
cd phase2-backend/functions
./package-lambda.sh

# Upload
aws lambda update-function-code \
  --function-name securebase-prod-texas-fintech-compliance \
  --zip-file fileb://../deploy/texas_fintech_compliance_collector.zip
```

---

## Customer Onboarding

1. Set customer `tier` to `fintech_pro` or `fintech_elite` in the `customers` table.
2. Provide a **read-only replica connection string** for the customer's transaction database (or use VPC peering).
3. Run the on-demand collection endpoint to seed the `tx_*` tables.
4. Schedule daily EventBridge collection.
5. Grant examiner access via the Examiner Portal (Cognito).

---

## Helper Functions (PostgreSQL)

```sql
-- List transactions ≥$10K without a CTR
SELECT * FROM check_ctr_filing_compliance('customer-uuid');

-- Detect structuring patterns (sub-$10K batches summing ≥$10K in 24h)
SELECT * FROM detect_structuring('customer-uuid', 24, 10000);

-- Compliance dashboard summary (used by portal)
SELECT get_tx_compliance_summary('customer-uuid');
```

---

## Evidence Retention

All evidence is stored in S3 with:

- **Object Lock (Compliance mode)** — prevents deletion for 5 years (7 TAC §33.35)
- **KMS encryption** — server-side encryption with customer-managed keys
- **KMS signing** — non-repudiation for examiner packages

---

## Examiner Portal (Phase 3b)

The React Examiner Portal (`phase3a-portal`) exposes:

- Transaction search (date range, amount, type)
- CTR/SAR viewer with FinCEN tracking IDs
- One-click evidence package download (CSV + PDF)
- Cognito authentication for examiner access

Access via `GET /fintech/compliance-status` (returns `get_tx_compliance_summary()`).
