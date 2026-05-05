# SecureBase FFIEC Integration Strategy

**Version:** 1.0  
**Owner:** SecureBase Engineering  
**Audience:** Solutions Engineers, Integration Engineers, Customer Engineering  
**Updated:** May 2026

---

## Overview

SecureBase automates compliance evidence collection for financial institutions subject to FFIEC examination standards, specifically:

- **BSA/AML** (Bank Secrecy Act / Anti-Money Laundering) under FinCEN supervision
- **Texas DOB** (Texas Department of Banking) examinations for licensed money transmitters
- **HB 1666** digital asset fund segregation requirements for Texas DASPs
- **FFIEC IT Examination Handbook** controls for cybersecurity and information security

The integration strategy describes how SecureBase connects to a customer's existing technology stack — transaction databases, AML systems, KYC/CIP providers, and reporting tools — to collect, sign, and vault evidence without moving sensitive data outside the customer's AWS environment.

---

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Customer AWS Account                          │
│                                                                   │
│  ┌────────────────┐   VPC Peering / Read Replica                 │
│  │  Transaction   │ ─────────────────────────────┐               │
│  │  Database      │                               │               │
│  │  (PostgreSQL / │                               ▼               │
│  │   MySQL)       │               ┌───────────────────────────┐  │
│  └────────────────┘               │  SecureBase Lambda        │  │
│                                   │  (VPC-attached, read-only) │  │
│  ┌────────────────┐   Webhook /   │                           │  │
│  │  AML System    │   REST API    │  texas_fintech_           │  │
│  │  (Unit21 /     │ ─────────────►│  compliance_collector.py  │  │
│  │   Sardine /    │               │                           │  │
│  │   Verafin)     │               └─────────────┬─────────────┘  │
│  └────────────────┘                             │                 │
│                                                 │                 │
│  ┌────────────────┐   REST API                  │                 │
│  │  KYC/CIP       │ ─────────────►──────────────┘                │
│  │  (Alloy /      │                             │                 │
│  │   Socure /     │                             │ collect         │
│  │   Jumio)       │                             ▼                 │
│  └────────────────┘               ┌───────────────────────────┐  │
│                                   │  SecureBase Aurora        │  │
│                                   │  PostgreSQL (tx_* tables) │  │
│                                   │  RLS per customer_id      │  │
│                                   └─────────────┬─────────────┘  │
│                                                 │ sign + vault    │
│                                                 ▼                 │
│                                   ┌───────────────────────────┐  │
│                                   │  S3 Evidence Bucket       │  │
│                                   │  Object Lock (Compliance) │  │
│                                   │  KMS encrypted + signed   │  │
│                                   └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Key principles:**
- All data stays in the **customer's AWS account** — no raw PII leaves the customer's VPC
- The SecureBase Lambda attaches to the customer's VPC with **read-only** IAM permissions
- Evidence is **KMS-signed** for non-repudiation (examiners cannot dispute authenticity)
- S3 Object Lock (Compliance mode) enforces **5-year retention** per 7 TAC §33.35

---

## Supported Integration Patterns

### Pattern 1: VPC Peering + Read Replica (Recommended)

Best for customers with AWS-hosted PostgreSQL or Aurora databases.

```
Customer VPC  ──── VPC Peering ────  SecureBase VPC
     │                                      │
  Read Replica  ◄─────────────────  Lambda (read-only IAM)
```

**Setup steps:**
1. Customer creates a read replica of their transaction database
2. Customer initiates VPC peering request to SecureBase VPC (CIDR provided during onboarding)
3. SecureBase deploys a Lambda function into the peered VPC
4. Lambda uses a read-only IAM role; no write access is granted
5. SecureBase tests connectivity and validates schema mapping

**Latency impact:** None on production database (replica handles all SecureBase queries)

**Schema requirements:** See [Database Schema Mapping](#database-schema-mapping)

---

### Pattern 2: API/Webhook Integration (No DB Access)

Best for customers who cannot grant database access, or whose AML system exposes a REST API.

```
AML System API  ──►  SecureBase Lambda  ──►  Evidence Vault (S3)
KYC/CIP API     ──►       │
                          ▼
                     Aurora (tx_* tables)
```

**Supported API sources:**
- **Unit21:** `/events`, `/rules/alerts` webhooks → maps to CTR/SAR evidence
- **Sardine:** `/cases`, `/decisions` webhooks → SAR evidence
- **Alloy:** `/persons/{id}`, `/evaluations` → CIP evidence
- **Socure:** `/verify`, `/decision` → CIP evidence
- **Jumio:** `/verifications` webhook → CIP evidence
- **Custom REST:** any JSON API with field mapping configured via `integration_config.json`

**Webhook endpoint:**
```
POST https://api.securebase.tximhotep.com/fintech/webhook/{customer_id}/{source}
Authorization: Bearer <customer_webhook_token>
```

**Supported sources:** `unit21`, `sardine`, `alloy`, `socure`, `jumio`, `custom`

---

### Pattern 3: Flat-File / S3 Export (Batch)

Best for legacy systems that export to CSV/JSON on a schedule.

```
Legacy System  ──►  S3 Drop Bucket  ──►  SecureBase Ingestion Lambda
                    (encrypted)                 │
                                                ▼
                                         Evidence Vault (S3)
```

**File format:** JSON (preferred) or CSV with header row  
**Drop bucket:** `s3://securebase-{env}-ingestion/{customer_id}/` (KMS encrypted)  
**Schedule:** Daily export at 02:00 UTC recommended (before daily evidence collection at 03:00 UTC)

---

## Database Schema Mapping

The SecureBase Lambda maps customer transaction fields to the `tx_transaction_records` table. Customers provide a `schema_mapping.json` file during onboarding.

### Required Field Mappings (TX-MT-R1)

| SecureBase Field | CFR Requirement | Customer Source | Example Customer Column |
|---|---|---|---|
| `transaction_id` | Unique identifier | Transaction DB | `id`, `txn_id`, `reference_number` |
| `transaction_timestamp` | Date/time of transaction | Transaction DB | `created_at`, `txn_date` |
| `amount_usd` | Transaction amount | Transaction DB | `amount`, `usd_amount` |
| `currency_code` | Currency | Transaction DB | `currency`, `currency_code` |
| `sender_name` | Sender full name | Transaction DB or CIP system | `sender_name`, `from_name` |
| `sender_address_line1` | Sender address | Transaction DB or CIP system | `sender_address`, `from_address` |
| `sender_id_type` | Government ID type | CIP system | `id_type`, `verification_type` |
| `sender_id_number` | Government ID number (hashed) | CIP system | `id_number` (SHA-256 hashed) |
| `recipient_name` | Recipient full name | Transaction DB | `recipient_name`, `to_name` |
| `payment_method` | Method of payment | Transaction DB | `payment_method`, `channel` |
| `fee_charged` | Fee amount | Transaction DB | `fee`, `service_fee` |
| `receipt_number` | Receipt/confirmation number | Transaction DB | `receipt_id`, `confirmation_number` |
| `processing_employee_id` | Employee who processed | Transaction DB | `processed_by`, `agent_id` |
| `texas_nexus` | TX connection flag | Derived or explicit | `state = 'TX'` or boolean column |

### Schema Mapping Configuration Example

```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_table": "transactions",
  "field_mappings": {
    "transaction_id": "id",
    "transaction_timestamp": "created_at",
    "amount_usd": "amount_cents / 100.0",
    "currency_code": "'USD'",
    "sender_name": "sender_full_name",
    "sender_address_line1": "sender_address_street",
    "sender_id_type": "\"kyc\".id_document_type",
    "sender_id_number": "sha256(\"kyc\".id_document_number)",
    "recipient_name": "beneficiary_name",
    "payment_method": "payment_channel",
    "fee_charged": "fee_amount",
    "receipt_number": "confirmation_number",
    "processing_employee_id": "agent_user_id",
    "texas_nexus": "origin_state = 'TX' OR destination_state = 'TX'"
  },
  "join_tables": [
    {
      "table": "kyc_verifications",
      "alias": "kyc",
      "join": "kyc.customer_id = transactions.customer_id"
    }
  ],
  "filters": {
    "texas_nexus": true,
    "date_range": "configurable at runtime"
  }
}
```

---

## Control-by-Control Integration Guide

### TX-MT-R1: Transaction Recordkeeping

**Regulation:** 31 CFR §1010.410(e), 7 TAC §33.35  
**Collection method:** Direct DB query or batch file  
**Frequency:** Daily at 03:00 UTC (configurable)  
**Compliance threshold:** ≥95% of sampled records must have all required fields

**What SecureBase collects:**
```sql
-- SecureBase runs this query (simplified) against the read replica
SELECT
  transaction_id,
  transaction_timestamp,
  amount_usd,
  sender_name,
  sender_address_line1,
  sender_id_type,
  sha256(sender_id_number::text) as sender_id_hash,
  recipient_name,
  payment_method,
  fee_charged,
  receipt_number,
  processing_employee_id
FROM transactions
WHERE texas_nexus = true
  AND transaction_timestamp BETWEEN :start AND :end
ORDER BY transaction_timestamp
LIMIT :sample_size;
```

**Evidence output:** `s3://securebase-evidence/{customer_id}/TX-MT-R1/{date}.json`

---

### TX-MT-R2a/b: CTR and SAR Filing Compliance

**Regulation:** 31 CFR §1022.310 (CTR), 31 CFR §1022.320 (SAR)  
**Collection method:** AML system API/webhook OR direct `ctr_filings` / `sar_filings` table  
**Frequency:** Daily  
**Compliance thresholds:**
- CTR: 100% of transactions >$10,000 must have CTR filed within 15 calendar days
- SAR: 100% of detected suspicious activity must have SAR filed within 30 calendar days

**Unit21 webhook mapping:**
```json
{
  "event_type": "alert.created",
  "alert_id": "→ sar_filings.aml_alert_id",
  "created_at": "→ sar_filings.detection_date",
  "transaction_ids": "→ sar_transactions (many-to-many)",
  "status": "→ sar_filings.status",
  "total_amount": "→ sar_filings.total_amount_usd"
}
```

**Structuring detection** (built into SecureBase Lambda):
```python
# Detects potential structuring: multiple sub-$10K transactions
# by same sender that sum to ≥$10K within 24-hour window
detect_structuring(customer_id, lookback_hours=24, threshold_usd=10000)
```

---

### TX-MT-R3: Customer Identification Program (CIP)

**Regulation:** 31 CFR §1022.210, 7 TAC §33.3  
**Collection method:** KYC/CIP system API (Alloy, Socure, Jumio) OR direct `fintech_customer_details` table  
**Frequency:** Daily  
**Compliance threshold:** 100% of active customers must have verified government ID

**Alloy API mapping:**
```json
{
  "GET /persons/{person_token}": {
    "name_first + name_last": "→ cip_records.customer_name",
    "birth_date": "→ cip_records.date_of_birth",
    "ssn_itin": "→ cip_records.tax_id_hash (SHA-256)",
    "addresses[0]": "→ cip_records.address",
    "documents[0].type": "→ cip_records.id_document_type",
    "documents[0].number": "→ cip_records.id_document_number_hash",
    "kyc_status": "→ cip_records.verification_status",
    "risk_rating": "→ cip_records.risk_rating"
  }
}
```

**PEP and OFAC screening** result stored in `cip_records.ofac_screened` (boolean) and `cip_records.pep_screened` (boolean).

---

### TX-MT-R4: Authorized Delegate Oversight

**Regulation:** 7 TAC §33.35(b)(3)  
**Collection method:** Customer provides delegate list via API or manual upload  
**Frequency:** Weekly  
**Compliance threshold:** 100% of active delegates have signed agreement + annual audit within last 365 days

**Delegate data input format:**
```json
{
  "delegates": [
    {
      "delegate_id": "uuid",
      "business_name": "Acme Remittance Center",
      "agreement_signed_date": "2024-01-15",
      "last_audit_date": "2024-06-15",
      "location_count": 3,
      "compliance_status": "compliant"
    }
  ]
}
```

---

### TX-DASP-R1: Digital Asset Fund Segregation

**Regulation:** TX HB 1666, Texas Finance Code §152  
**Applies to:** Customers with ≥500 TX customers OR ≥$10M in customer digital asset funds  
**Collection method:** Direct DB query to `digital_asset_accounts` and `company_accounts`  
**Frequency:** Daily  
**Compliance threshold:** Customer funds must be fully segregated from company operational funds

**Balance reconciliation query:**
```sql
-- SecureBase runs daily to verify segregation
SELECT
  SUM(da.balance_usd) as total_customer_funds,
  (SELECT balance_usd FROM company_accounts WHERE customer_id = :cid) as company_funds,
  CASE
    WHEN SUM(da.balance_usd) <= (SELECT balance_usd FROM company_accounts WHERE customer_id = :cid)
    THEN 'SEGREGATED'
    ELSE 'COMMINGLING_DETECTED'
  END as segregation_status
FROM digital_asset_accounts da
WHERE da.customer_id = :cid
  AND da.account_type = 'customer_custody';
```

---

## Security Architecture

### Data Residency

All raw transaction data and PII remains in the customer's AWS account:

| Data Type | Location | Access |
|---|---|---|
| Raw transaction records | Customer's RDS/Aurora read replica | Read-only Lambda query |
| PII (names, addresses, IDs) | Customer's database — never exported | Hashed before leaving the VPC |
| Evidence records (aggregates) | SecureBase Aurora (`tx_*` tables) | Row-Level Security per `customer_id` |
| Evidence packages (signed) | Customer's S3 bucket (Object Lock) | Examiner Portal only |
| Signing keys | Customer's KMS (CMK) | Lambda IAM role only |

### PII Handling

**SecureBase never stores raw PII.** All sensitive fields are hashed before storage:

```python
import hashlib

def hash_pii(value: str, salt: str) -> str:
    """SHA-256 hash with per-customer salt (stored in Secrets Manager)."""
    return hashlib.sha256(f"{salt}:{value}".encode()).hexdigest()

# Usage in evidence collection
sender_id_hash = hash_pii(raw_id_number, customer_salt)
```

The per-customer salt is stored in AWS Secrets Manager and rotated annually.

### IAM Permissions (Principle of Least Privilege)

**SecureBase Lambda execution role — minimum required permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:securebase/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:GetPublicKey"],
      "Resource": "arn:aws:kms:us-east-1:*:key/*",
      "Condition": {
        "StringEquals": {"kms:ViaService": "lambda.us-east-1.amazonaws.com"}
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::securebase-evidence-*/*"
    },
    {
      "Effect": "Deny",
      "Action": ["s3:DeleteObject", "s3:DeleteBucket"],
      "Resource": "*"
    }
  ]
}
```

**Customer read-only role (for VPC peering):**
```sql
-- PostgreSQL: grant read-only to SecureBase Lambda user
CREATE ROLE securebase_readonly;
GRANT CONNECT ON DATABASE securebase TO securebase_readonly;
GRANT USAGE ON SCHEMA public TO securebase_readonly;
GRANT SELECT ON transactions, ctr_filings, sar_filings,
               kyc_verifications, digital_asset_accounts
  TO securebase_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM securebase_readonly;
```

### Evidence Signing and Integrity

Every evidence package is:
1. **SHA-256 hashed** record-by-record
2. **KMS-signed** with the customer's CMK (RSA-4096)
3. **Manifest generated** listing all record hashes + overall package hash
4. **Stored in S3 with Object Lock** (Compliance mode, 5-year retention)

```python
# Evidence signing (from texas_fintech_compliance_collector.py)
def sign_evidence_package(package_data: dict, kms_key_id: str) -> dict:
    package_json = json.dumps(package_data, sort_keys=True).encode()
    package_hash = hashlib.sha256(package_json).hexdigest()

    response = kms_client.sign(
        KeyId=kms_key_id,
        Message=package_hash.encode(),
        MessageType='RAW',
        SigningAlgorithm='RSASSA_PKCS1_V1_5_SHA_256'
    )
    return {
        "package_hash": package_hash,
        "signature": base64.b64encode(response['Signature']).decode(),
        "key_id": kms_key_id
    }
```

---

## Deployment Guide

### Prerequisites

| Requirement | Detail |
|---|---|
| AWS Account | Customer must have AWS account (any region, us-east-1 or us-west-2 preferred) |
| Transaction DB | PostgreSQL 12+ or MySQL 8+ (Aurora, RDS, or self-managed) |
| AML System | Unit21, Sardine, Verafin, or custom webhook-capable system |
| KYC/CIP System | Alloy, Socure, or Jumio (API access required) |
| S3 Bucket | Object Lock-enabled bucket in customer's account |
| KMS Key | RSA-4096 CMK for evidence signing |

### Step-by-Step Onboarding

**Step 1: Database Schema Mapping (Day 1)**
```bash
# Download the schema mapping template
curl -O https://docs.securebase.io/onboarding/schema_mapping_template.json

# Fill in your field mappings
# See: Database Schema Mapping section above

# Upload to SecureBase onboarding portal
POST /api/onboarding/schema-mapping
Authorization: Bearer <onboarding_token>
Content-Type: application/json
<schema_mapping.json contents>
```

**Step 2: VPC Peering or API Configuration (Day 1–2)**

*Option A — VPC Peering:*
```bash
# SecureBase provides VPC ID and CIDR during onboarding
# Customer initiates peering request in AWS Console:
# VPC → Peering Connections → Create Peering Connection
# Requester: Customer VPC
# Accepter: SecureBase VPC (ID provided by SecureBase)
```

*Option B — AML System Webhooks:*
```bash
# Register SecureBase as a webhook destination in your AML system
# Unit21 example:
POST https://app.unit21.ai/api/v1/webhooks
{
  "url": "https://api.securebase.tximhotep.com/fintech/webhook/<customer_id>/unit21",
  "events": ["alert.created", "case.filed", "ctr.filed"],
  "secret": "<provided_by_securebase>"
}
```

**Step 3: S3 Evidence Bucket Setup (Day 2)**
```bash
# Create S3 bucket with Object Lock
aws s3api create-bucket \
  --bucket securebase-evidence-<customer_id> \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

# Configure default Object Lock retention (5 years = 1826 days)
aws s3api put-object-lock-configuration \
  --bucket securebase-evidence-<customer_id> \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 1826
      }
    }
  }'
```

**Step 4: KMS Key Setup (Day 2)**
```bash
# Create RSA-4096 KMS key for evidence signing
aws kms create-key \
  --key-usage SIGN_VERIFY \
  --key-spec RSA_4096 \
  --description "SecureBase FFIEC evidence signing key" \
  --tags '[{"TagKey":"Purpose","TagValue":"FFIEC_evidence_signing"}]'

# Grant SecureBase Lambda role access to sign
aws kms create-grant \
  --key-id <key-id> \
  --grantee-principal arn:aws:iam::<account>:role/securebase-lambda-role \
  --operations Sign GetPublicKey
```

**Step 5: Lambda Deployment (Day 3)**
```bash
# SecureBase deploys the collector Lambda into the peered VPC
# Terraform (managed by SecureBase):
resource "aws_lambda_function" "texas_fintech_compliance" {
  function_name = "securebase-${var.environment}-texas-fintech-compliance-${var.customer_id}"
  filename      = "deploy/texas_fintech_compliance_collector.zip"
  role          = aws_iam_role.securebase_lambda.arn
  handler       = "texas_fintech_compliance_collector.lambda_handler"
  runtime       = "python3.11"
  timeout       = 300
  memory_size   = 512

  vpc_config {
    subnet_ids         = var.customer_subnet_ids
    security_group_ids = [aws_security_group.securebase_lambda.id]
  }

  environment {
    variables = {
      RDS_HOST          = var.customer_db_endpoint
      RDS_SECRET_ARN    = aws_secretsmanager_secret.db_creds.arn
      KMS_KEY_ID        = var.customer_kms_key_id
      S3_EVIDENCE_BUCKET = var.customer_evidence_bucket
      CUSTOMER_ID       = var.customer_id
      ENVIRONMENT       = var.environment
    }
  }
}
```

**Step 6: POC Validation (Week 1–2)**
```bash
# Trigger on-demand evidence collection for the POC period
POST /fintech/collect
Authorization: Bearer <api_key>
{
  "customer_id": "<uuid>",
  "controls": ["TX-MT-R1", "TX-MT-R2a", "TX-MT-R2b", "TX-MT-R3"],
  "start_date": "2025-01-01",
  "end_date": "2025-03-31",
  "sample_size": 500
}
```

**Step 7: Schedule Daily Collection (Day 14 — Go Live)**
```bash
# EventBridge rule runs daily at 03:00 UTC
aws events put-rule \
  --name "securebase-daily-evidence-collection-<customer_id>" \
  --schedule-expression "cron(0 3 * * ? *)" \
  --state ENABLED

aws events put-targets \
  --rule "securebase-daily-evidence-collection-<customer_id>" \
  --targets '[{
    "Id": "texas_fintech_compliance",
    "Arn": "arn:aws:lambda:us-east-1:<account>:function:securebase-prod-texas-fintech-compliance-<customer_id>"
  }]'
```

---

## API Reference

### Evidence Collection

```
POST /fintech/collect
Authorization: Bearer <api_key>

{
  "customer_id": "uuid",
  "controls": ["TX-MT-R1", "TX-MT-R2a", "TX-MT-R2b", "TX-MT-R3", "TX-MT-R4", "TX-DASP-R1"],
  "start_date": "2025-01-01",    // ISO 8601
  "end_date": "2025-03-31",
  "sample_size": 500             // optional; default: all records
}

Response 200:
{
  "collection_id": "uuid",
  "customer_id": "uuid",
  "controls_collected": ["TX-MT-R1", "TX-MT-R2a", "TX-MT-R2b", "TX-MT-R3"],
  "compliance_scores": {
    "TX-MT-R1": 98.7,
    "TX-MT-R2a": 100.0,
    "TX-MT-R2b": 100.0,
    "TX-MT-R3": 96.4
  },
  "evidence_s3_keys": ["evidence/prod/uuid/TX-MT-R1/2025-03-31.json", "..."],
  "collection_timestamp": "2025-04-01T03:00:00Z"
}
```

### Examiner Package Generation

```
POST /fintech/examiner-export
Authorization: Bearer <api_key>

{
  "customer_id": "uuid",
  "period_start": "2025-01-01",
  "period_end": "2025-03-31",
  "examiner_name": "Jane Smith",
  "examiner_email": "jsmith@dob.texas.gov",
  "controls": ["TX-MT-R1", "TX-MT-R2a", "TX-MT-R2b", "TX-MT-R3"]  // optional
}

Response 200:
{
  "export_reference": "TX-EXAM-PROD-20250401120000-A1B2C3D4",
  "s3_key": "evidence/prod/uuid/examiner_export/TX-EXAM-PROD-20250401120000-A1B2C3D4.zip",
  "package_hash": "sha256:abc123...",
  "signature": "base64_kms_signature...",
  "record_counts": {
    "transactions": 1247,
    "ctr_filings": 3,
    "sar_filings": 1,
    "cip_records": 482
  },
  "generated_at": "2025-04-01T12:00:00Z"
}
```

### Compliance Status

```
GET /fintech/compliance-status?customer_id=<uuid>
Authorization: Bearer <api_key>

Response 200:
{
  "customer_id": "uuid",
  "overall_score": 94.2,
  "last_collected": "2025-04-01T03:00:00Z",
  "controls": [
    {
      "control_id": "TX-MT-R1",
      "name": "Transaction Recordkeeping",
      "score": 98.7,
      "status": "passing",
      "last_collected": "2025-04-01T03:00:00Z",
      "findings": 16
    },
    {
      "control_id": "TX-MT-R2a",
      "name": "CTR Filing Compliance",
      "score": 100.0,
      "status": "passing",
      "last_collected": "2025-04-01T03:00:00Z",
      "findings": 0
    }
  ]
}
```

---

## FFIEC IT Examination Handbook Integration

Beyond BSA/AML, FFIEC-regulated institutions are also subject to the **FFIEC IT Examination Handbook** (Cybersecurity, Information Security, Management). SecureBase maps these controls to existing SOC 2 / CIS controls already on the platform:

| FFIEC IT Handbook Domain | SecureBase Control Mapping |
|---|---|
| Access Controls (AC) | CIS Control 5, 6; SOC 2 CC6.1 |
| Audit Logging (AL) | CloudTrail + Aurora audit logs; SOC 2 CC7.2 |
| Configuration Management (CM) | CIS Control 4; SOC 2 CC7.1 |
| Incident Response (IR) | SOC 2 CC7.3, CC7.4; GuardDuty alerts |
| Network Security (NS) | CIS Control 9, 12; VPC + WAF |
| Risk Management (RM) | SOC 2 CC3.1, CC3.2 |
| Third-Party Management (TPM) | SOC 2 CC9.1, CC9.2 |

**Examiner Report Sections:**

The FFIEC compliance report exported from SecureBase includes:
1. **Executive Summary** — overall risk rating (Low / Moderate / High)
2. **BSA/AML Evidence** — TX-MT-R1 through TX-DASP-R1 results
3. **IT Controls** — SOC 2 / CIS control status mapped to FFIEC handbook
4. **Findings & Recommendations** — flagged items with remediation guidance
5. **Evidence Manifest** — SHA-256 hashes + KMS signatures for all evidence records

---

## Multi-Region Considerations

For Fintech Elite customers with operations across multiple states:

| State | Regulator | Additional Controls |
|---|---|---|
| **Texas** | TX DOB + FinCEN | TX-MT-R1 through TX-DASP-R1 (fully automated) |
| **New York** | NY DFS (Part 504) | SAR lookback period, transaction monitoring program |
| **California** | CA DFPI (CDFIL) | CA-specific CIP requirements, non-resident remittance rules |
| **Florida** | FL OFR | FL Chapter 560 recordkeeping requirements |

Multi-state evidence collection is available on **Fintech Elite** at $12,000/month. Each additional state adds 2–4 new controls mapped to that state's money services business regulations.

---

## Troubleshooting

### Evidence collection returns empty results
```bash
# Check: Is texas_nexus flag set on transactions?
SELECT COUNT(*) FROM transactions WHERE texas_nexus = true;

# If zero, verify the field mapping or add a derived field:
ALTER TABLE transactions ADD COLUMN texas_nexus BOOLEAN
  GENERATED ALWAYS AS (origin_state = 'TX' OR destination_state = 'TX') STORED;
```

### Lambda times out during large collection
```bash
# Reduce sample_size or collect one control at a time:
POST /fintech/collect
{
  "controls": ["TX-MT-R1"],
  "sample_size": 200
}
```

### KMS signature verification fails
```bash
# Verify public key is accessible:
aws kms get-public-key --key-id <key-id>

# Verify Lambda role has kms:Sign permission:
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::<account>:role/securebase-lambda-role \
  --action-names kms:Sign \
  --resource-arns arn:aws:kms:us-east-1:<account>:key/<key-id>
```

### CTR counts don't match AML system
```bash
# Check: Are CTR filings ingested via webhook?
GET /fintech/compliance-status?customer_id=<uuid>&debug=true

# Look for: "ctr_source": "webhook" vs "ctr_source": "database"
# If webhook: verify Unit21/Sardine webhook is registered and active
# If database: verify ctr_filings table has correct customer_id FK
```

---

## References

| Resource | Location |
|---|---|
| FFIEC Sales Playbook | [`docs/FFIEC_SALES_PLAYBOOK.md`](./FFIEC_SALES_PLAYBOOK.md) |
| Texas Fintech Compliance Controls | [`docs/TEXAS_FINTECH_COMPLIANCE.md`](./TEXAS_FINTECH_COMPLIANCE.md) |
| Compliance Lambda Source | `phase2-backend/functions/texas_fintech_compliance_collector.py` |
| Database Schema | `phase2-backend/database/migrations/005_texas_fintech_compliance.sql` |
| Fintech Pro MVP Spec | [`docs/fintech_pro_mvp_spec.md`](./fintech_pro_mvp_spec.md) |
| Quick Reference | [`docs/TEXAS_FINTECH_QUICK_REFERENCE.md`](./TEXAS_FINTECH_QUICK_REFERENCE.md) |

---

*Maintained by: SecureBase Engineering · Questions: compliance-tech@securebase.io*
