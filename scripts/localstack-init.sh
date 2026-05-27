#!/usr/bin/env bash
# scripts/localstack-init.sh
# Creates local AWS resources in LocalStack for Phase 6.2 development.
# Run after: docker compose up -d && docker compose exec localstack bash scripts/localstack-init.sh
# Or: ./scripts/localstack-init.sh (requires awslocal CLI or AWS_ENDPOINT_URL=http://localhost:4566)

set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"
AWS="aws --endpoint-url=$ENDPOINT --region=$REGION"

echo "==> Creating DynamoDB tables..."

# compliance scores table (matches compliance_score_recalculator.py)
$AWS dynamodb create-table \
  --table-name securebase-compliance-scores \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "  securebase-compliance-scores already exists"

# control violation log table
$AWS dynamodb create-table \
  --table-name control_violation_log \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "  control_violation_log already exists"

# vendor risk table (Phase 6.2 Component 5)
$AWS dynamodb create-table \
  --table-name securebase-vendor-risk \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "  securebase-vendor-risk already exists"

# compliance export jobs table
$AWS dynamodb create-table \
  --table-name securebase-compliance-exports \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "  securebase-compliance-exports already exists"

echo "==> Creating S3 buckets..."

$AWS s3 mb s3://securebase-compliance-evidence-local 2>/dev/null || echo "  bucket already exists"
$AWS s3 mb s3://securebase-mappings-local 2>/dev/null || echo "  bucket already exists"

echo "==> Uploading compliance mapping files to S3..."
for f in phase6-backend/compliance/*.json; do
  [ -f "$f" ] || continue
  filename=$(basename "$f")
  $AWS s3 cp "$f" "s3://securebase-mappings-local/compliance/$filename" --no-progress
  echo "  uploaded $filename"
done

echo "==> Creating SQS queues..."
$AWS sqs create-queue --queue-name compliance-export-jobs 2>/dev/null || echo "  queue already exists"
$AWS sqs create-queue --queue-name score-recalc-jobs 2>/dev/null || echo "  queue already exists"

echo ""
echo "✅ LocalStack resources ready."
echo ""
echo "Quick test:"
echo "  aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1"