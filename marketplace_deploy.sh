#!/usr/bin/env bash
# =============================================================================
# SecureBase — Marketplace prod deploy with before/after state comparison
# Run from repo root: ./marketplace_deploy.sh
#
# What it does:
#   1. Capture before state  → before.json
#   2. Copy Lambda zips dev → prod S3
#   3. terraform apply       → marketplace.tfvars
#   4. Capture after state   → after.json
#   5. Print structured diff
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROD_DIR="${REPO_ROOT}/landing-zone/environments/prod"
BACKEND_HCL="${REPO_ROOT}/landing-zone/environments/production/backend.hcl"
AUDIT_SCRIPT="${REPO_ROOT}/marketplace_audit.sh"
REGION="us-east-1"
DEV_BUCKET="securebase-terraform-state-dev"
PROD_BUCKET="securebase-terraform-state-prod"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   SecureBase Marketplace Prod Deploy                     ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S %Z')                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---------------------------------------------------------------------------
# 0. Verify AWS identity
# ---------------------------------------------------------------------------
echo "▶ Verifying AWS identity..."
IDENTITY=$(aws sts get-caller-identity --output json)
ACCT=$(echo "$IDENTITY" | jq -r '.Account')
ARN=$(echo "$IDENTITY" | jq -r '.Arn')
echo "  Account : $ACCT"
echo "  Identity: $ARN"
if [ "$ACCT" != "731184206915" ]; then
  echo "  ✗ Wrong account. Expected 731184206915. Aborting."
  exit 1
fi
echo "  ✓ Correct account"
echo ""

# ---------------------------------------------------------------------------
# 1. Before state snapshot
# ---------------------------------------------------------------------------
echo "▶ Capturing BEFORE state..."
bash "$AUDIT_SCRIPT" > "${REPO_ROOT}/before.json"
echo "  Saved → before.json"
echo "  Lambda presence:"
for fn in resolve-customer subscription-handler metering-worker; do
  present=$(jq -r ".lambdas[\"securebase-production-marketplace-${fn}\"] // \"MISSING\"" "${REPO_ROOT}/before.json")
  if [ "$present" = "MISSING" ] || [ "$present" = "null" ]; then
    echo "    securebase-production-marketplace-${fn}: ✗ NOT PRESENT"
  else
    echo "    securebase-production-marketplace-${fn}: ✓ EXISTS (State: $(echo "$present" | jq -r '.State // "unknown"'))"
  fi
done
echo ""

# ---------------------------------------------------------------------------
# 2. Copy Lambda zips from dev to prod S3
# ---------------------------------------------------------------------------
echo "▶ Copying Lambda zips dev → prod S3..."
ZIP_PAIRS=(
  "lambda/marketplace_resolve_customer.zip:lambda/marketplace_resolve_customer.zip"
  "lambda/marketplace-entitlement.zip:lambda/marketplace-entitlement.zip"
  "lambda/marketplace-metering.zip:lambda/marketplace-metering.zip"
)
for pair in "${ZIP_PAIRS[@]}"; do
  src="${pair%%:*}"
  dst="${pair##*:}"
  echo "  s3://${DEV_BUCKET}/${src} → s3://${PROD_BUCKET}/${dst}"
  aws s3 cp "s3://${DEV_BUCKET}/${src}" "s3://${PROD_BUCKET}/${dst}" --region "$REGION"
  echo "    ✓ Copied"
done
echo ""

# ---------------------------------------------------------------------------
# 3. Terraform plan first (review before apply)
# ---------------------------------------------------------------------------
echo "▶ Running terraform plan..."
cd "$PROD_DIR"
terraform init -backend-config="$BACKEND_HCL" -reconfigure -input=false
terraform plan \
  -var-file=marketplace.tfvars \
  -out=marketplace.tfplan \
  -input=false
echo ""
echo "  Plan saved → marketplace.tfplan"
echo ""

# Prompt for confirmation
read -r -p "  Review plan above. Proceed with apply? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "  Aborted. Plan saved at ${PROD_DIR}/marketplace.tfplan"
  exit 0
fi
echo ""

# ---------------------------------------------------------------------------
# 4. Terraform apply
# ---------------------------------------------------------------------------
echo "▶ Running terraform apply..."
terraform apply marketplace.tfplan
echo ""
echo "  ✓ Apply complete"
echo ""

# ---------------------------------------------------------------------------
# 5. After state snapshot
# ---------------------------------------------------------------------------
echo "▶ Capturing AFTER state..."
sleep 5  # give AWS a moment to propagate
bash "$AUDIT_SCRIPT" > "${REPO_ROOT}/after.json"
echo "  Saved → after.json"
echo ""

# ---------------------------------------------------------------------------
# 6. Structured diff
# ---------------------------------------------------------------------------
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Before vs After Comparison                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "── Lambda functions ──"
for fn in resolve-customer subscription-handler metering-worker; do
  FULL="securebase-production-marketplace-${fn}"
  before_state=$(jq -r ".lambdas[\"${FULL}\"] // \"null\"" "${REPO_ROOT}/before.json")
  after_state=$(jq -r ".lambdas[\"${FULL}\"]  // \"null\"" "${REPO_ROOT}/after.json")
  before_name=$(echo "$before_state" | jq -r '.FunctionName // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
  after_name=$(echo "$after_state"  | jq -r '.FunctionName // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
  after_code=$(echo "$after_state"  | jq -r '.ProductCode  // "—"'           2>/dev/null || echo "—")
  after_runtime=$(echo "$after_state" | jq -r '.Runtime    // "—"'           2>/dev/null || echo "—")

  if [ "$before_name" = "NOT PRESENT" ] && [ "$after_name" != "NOT PRESENT" ]; then
    echo "  ✓ CREATED  ${FULL}"
    echo "    Runtime: ${after_runtime}  |  MARKETPLACE_PRODUCT_CODE: ${after_code}"
  elif [ "$before_name" != "NOT PRESENT" ] && [ "$after_name" != "NOT PRESENT" ]; then
    before_code=$(echo "$before_state" | jq -r '.ProductCode // "—"' 2>/dev/null || echo "—")
    echo "  ~ UPDATED  ${FULL}"
    echo "    ProductCode before: ${before_code}  →  after: ${after_code}"
  else
    echo "  ✗ MISSING  ${FULL} (not present before or after — check apply)"
  fi
done
echo ""

echo "── SNS internal topic ──"
before_topic=$(jq -r '.sns.internal_topic // "null"' "${REPO_ROOT}/before.json")
after_topic=$(jq  -r '.sns.internal_topic // "null"' "${REPO_ROOT}/after.json")
before_arn=$(echo "$before_topic" | jq -r '.TopicArn // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
after_arn=$(echo "$after_topic"  | jq -r '.TopicArn // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
after_subs=$(echo "$after_topic" | jq -r '.Subscriptions | length // 0' 2>/dev/null || echo "0")
if [ "$before_arn" = "NOT PRESENT" ] && [ "$after_arn" != "NOT PRESENT" ]; then
  echo "  ✓ CREATED  $after_arn  (${after_subs} subscription(s))"
else
  echo "  ${before_arn}  →  ${after_arn}  (${after_subs} subs)"
fi
echo ""

echo "── AWS Marketplace SNS subscription ──"
before_mpsub=$(jq '.sns.aws_marketplace_topic_subscriptions | length' "${REPO_ROOT}/before.json" 2>/dev/null || echo 0)
after_mpsub=$(jq  '.sns.aws_marketplace_topic_subscriptions | length' "${REPO_ROOT}/after.json"  2>/dev/null || echo 0)
echo "  Before: ${before_mpsub} subscription(s)  →  After: ${after_mpsub} subscription(s)"
if [ "$after_mpsub" -gt 0 ]; then
  jq -r '.sns.aws_marketplace_topic_subscriptions[] | "  ✓ \(.SubscriptionArn)"' "${REPO_ROOT}/after.json" 2>/dev/null || true
fi
echo ""

echo "── EventBridge metering rule ──"
before_rule=$(jq -r '.eventbridge.State // "NOT PRESENT"' "${REPO_ROOT}/before.json" 2>/dev/null || echo "NOT PRESENT")
after_rule=$(jq  -r '.eventbridge.State // "NOT PRESENT"' "${REPO_ROOT}/after.json"  2>/dev/null || echo "NOT PRESENT")
after_schedule=$(jq -r '.eventbridge.ScheduleExpression // "—"' "${REPO_ROOT}/after.json" 2>/dev/null || echo "—")
echo "  Before: ${before_rule}  →  After: ${after_rule}  (${after_schedule})"
echo ""

echo "── CloudWatch alarms ──"
for alarm_suffix in "metering-worker-errors" "resolve-customer-errors" "subscription-handler-errors"; do
  alarm_key="securebase-production-marketplace-${alarm_suffix}"
  before_val=$(jq -r ".cloudwatch_alarms[\"${alarm_key}\"] // \"null\"" "${REPO_ROOT}/before.json")
  after_val=$(jq  -r ".cloudwatch_alarms[\"${alarm_key}\"] // \"null\"" "${REPO_ROOT}/after.json")
  before_state=$(echo "$before_val" | jq -r '.StateValue // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
  after_state=$(echo "$after_val"  | jq -r '.StateValue  // "NOT PRESENT"' 2>/dev/null || echo "NOT PRESENT")
  if [ "$before_state" = "NOT PRESENT" ] && [ "$after_state" != "NOT PRESENT" ]; then
    echo "  ✓ CREATED  ${alarm_key}  (${after_state})"
  else
    echo "  ${alarm_key}: ${before_state} → ${after_state}"
  fi
done
echo ""

echo "── S3 Lambda zips ──"
for key in "lambda/marketplace_resolve_customer.zip" "lambda/marketplace-entitlement.zip" "lambda/marketplace-metering.zip"; do
  before_size=$(jq -r ".s3_lambda_zips[\"${key}\"].ContentLength // \"MISSING\"" "${REPO_ROOT}/before.json" 2>/dev/null || echo "MISSING")
  after_size=$(jq  -r ".s3_lambda_zips[\"${key}\"].ContentLength // \"MISSING\"" "${REPO_ROOT}/after.json"  2>/dev/null || echo "MISSING")
  echo "  ${key}: ${before_size} bytes → ${after_size} bytes"
done
echo ""

echo "── Terraform state resources ──"
after_tf=$(jq '.terraform_state_marketplace_resources' "${REPO_ROOT}/after.json" 2>/dev/null || echo '[]')
count=$(echo "$after_tf" | jq 'length')
echo "  module.marketplace[0] resources tracked in state: ${count}"
echo "$after_tf" | jq -r '.[] | "  · \(.type).\(.name)"' 2>/dev/null || true
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Deploy complete. Artifacts: before.json / after.json  ║"
echo "╚══════════════════════════════════════════════════════════╝"
