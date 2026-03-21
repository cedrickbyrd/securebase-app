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
