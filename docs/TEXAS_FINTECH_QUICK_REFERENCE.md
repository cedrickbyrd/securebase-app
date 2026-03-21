# Texas Fintech Compliance - Quick Reference

## Quick Start

### 1. Deploy Database Migration

```bash
# Apply migration to add Texas fintech tables
cd phase2-backend/database
psql -h $RDS_ENDPOINT -U $DB_USER -d securebase \
  -f migrations/005_texas_fintech_compliance.sql
```

### 2. Seed Test Data

```bash
# Generate test data for a customer
cd phase2-backend/database
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_USER=postgres
export DB_PASSWORD=your-password

python seed_texas_fintech_data.py \
  --customer-id 550e8400-e29b-41d4-a716-446655440000 \
  --customers 50 \
  --transactions 100
```

### 3. Deploy Lambda Function

```bash
# Package Lambda function
cd phase2-backend/functions
./package-lambda.sh texas_fintech_compliance_collector

# Deploy via Terraform
cd ../../../landing-zone/environments/dev
terraform apply -target=module.lambda_functions.aws_lambda_function.texas_fintech_compliance
```

### 4. Test Lambda Function

```bash
# Create test event
cat > test-texas-compliance.json <<EOF
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "controls": ["TX-MT-R1", "TX-MT-R2"],
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "sample_size": 20
}
EOF

# Invoke Lambda
aws lambda invoke \
  --function-name dev-texas-fintech-compliance-collector \
  --payload file://test-texas-compliance.json \
  --cli-binary-format raw-in-base64-out \
  response.json

# View response
cat response.json | jq .
```

## Control IDs

| Control ID | Description | Regulation |
|------------|-------------|------------|
| TX-MT-R1 | Transaction Recordkeeping | 7 TAC §33.35 |
| TX-MT-R2 | CTR/SAR Filing Evidence | 31 CFR §1022.320 |
| TX-MT-R3 | Customer Identification Program | 31 CFR §1022.210 |
| TX-MT-R4 | Authorized Delegate Oversight | 7 TAC §33.35(b)(3) |
| TX-DASP-R1 | Digital Asset Segregation | HB 1666 |

## Key Compliance Thresholds

- **CTR Filing**: Transactions > $10,000 must be reported within 15 days
- **SAR Filing**: Suspicious activity must be reported within 30 days
- **Structuring Detection**: Multiple transactions $8,000-$9,999 flag for review
- **DASP Requirements**: Applies if 500+ TX customers OR $10M+ customer funds
- **Record Retention**: 5 years minimum (7 years for FinCEN)

## Database Tables

```sql
-- Core tables
fintech_transactions           -- Transaction records
fintech_customer_details       -- KYC/CIP data
ctr_filings                    -- Currency Transaction Reports
sar_filings                    -- Suspicious Activity Reports
authorized_delegates           -- Delegate oversight
digital_asset_accounts         -- DASP accounts
company_accounts               -- Company operational funds

-- Helper functions
check_ctr_filing_compliance(customer_id, start_date, end_date)
detect_structuring(customer_id, lookback_days)
```

## Lambda Environment Variables

```bash
RDS_ENDPOINT=securebase-prod.cluster-xxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
DB_NAME=securebase
RDS_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:rds-creds
EVIDENCE_BUCKET=securebase-texas-compliance-evidence
```

## Evidence Storage

Evidence stored in S3:
```
s3://securebase-texas-compliance-evidence/
└── {customer_id}/
    └── texas-fintech/
        ├── TX-MT-R1/20240321-194500.json
        ├── TX-MT-R2/20240321-194530.json
        ├── TX-MT-R3/20240321-194600.json
        ├── TX-MT-R4/20240321-194630.json
        └── TX-DASP-R1/20240321-194700.json
```

## Common Commands

### Check CTR Compliance
```sql
SELECT * FROM check_ctr_filing_compliance(
  '550e8400-e29b-41d4-a716-446655440000',
  '2024-01-01',
  '2024-03-31'
);
```

### Detect Structuring
```sql
SELECT * FROM detect_structuring(
  '550e8400-e29b-41d4-a716-446655440000',
  30  -- lookback days
);
```

### View CTR Filing Status
```sql
SELECT 
  COUNT(*) as total_ctr_eligible,
  SUM(CASE WHEN ctr_filed THEN 1 ELSE 0 END) as ctrs_filed,
  ROUND(AVG(CASE WHEN filed_on_time THEN 100.0 ELSE 0 END), 2) as compliance_rate
FROM ctr_filings
WHERE customer_id = '550e8400-e29b-41d4-a716-446655440000';
```

### View SAR Filing Status
```sql
SELECT 
  activity_type,
  COUNT(*) as count,
  SUM(total_amount) as total_amount,
  ROUND(AVG(days_to_file), 1) as avg_days_to_file
FROM sar_filings
WHERE customer_id = '550e8400-e29b-41d4-a716-446655440000'
GROUP BY activity_type;
```

## Monitoring Queries

### Check Recent Compliance Collection
```sql
SELECT 
  control_id,
  status,
  last_collected,
  valid_until
FROM evidence_records
WHERE customer_id = '550e8400-e29b-41d4-a716-446655440000'
  AND control_id LIKE 'TX-%'
ORDER BY last_collected DESC;
```

### Identify Non-Compliant Transactions
```sql
SELECT 
  ft.transaction_id,
  ft.amount_usd,
  ft.transaction_timestamp,
  CASE 
    WHEN sender_name IS NULL THEN 'Missing sender name'
    WHEN sender_address_line1 IS NULL THEN 'Missing address'
    WHEN sender_id_type IS NULL THEN 'Missing ID verification'
    WHEN receipt_number IS NULL THEN 'Missing receipt'
    ELSE 'Unknown issue'
  END as compliance_issue
FROM fintech_transactions ft
WHERE ft.customer_id = '550e8400-e29b-41d4-a716-446655440000'
  AND (
    sender_name IS NULL OR
    sender_address_line1 IS NULL OR
    sender_id_type IS NULL OR
    receipt_number IS NULL
  );
```

## Troubleshooting

### Issue: Lambda timeout
**Solution**: Reduce sample_size or collect controls individually

```json
{
  "customer_id": "uuid",
  "controls": ["TX-MT-R1"],  // One at a time
  "sample_size": 50           // Smaller sample
}
```

### Issue: Database connection failure
**Solution**: Check Lambda VPC configuration and security groups

```bash
# Verify Lambda is in correct VPC
aws lambda get-function-configuration \
  --function-name dev-texas-fintech-compliance-collector \
  --query 'VpcConfig'

# Check security group allows PostgreSQL (5432)
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx \
  --query 'SecurityGroups[0].IpPermissions'
```

### Issue: Missing transaction data
**Solution**: Verify tables are populated and texas_nexus flag is set

```sql
-- Check transaction count
SELECT COUNT(*) FROM fintech_transactions 
WHERE customer_id = 'uuid' AND texas_nexus = true;

-- If zero, seed test data
-- See "Seed Test Data" section above
```

## Support Contacts

- **Technical Support**: compliance-tech@securebase.io
- **Compliance Questions**: Chief Compliance Officer (cco@securebase.io)
- **Emergency**: PagerDuty on-call rotation

## References

- [Full Documentation](../docs/TEXAS_FINTECH_COMPLIANCE.md)
- [Database Schema](./migrations/005_texas_fintech_compliance.sql)
- [Lambda Function](../functions/texas_fintech_compliance_collector.py)
- [Unit Tests](../functions/test_texas_fintech_compliance_collector.py)
