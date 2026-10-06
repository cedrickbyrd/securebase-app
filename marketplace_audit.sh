#!/usr/bin/env bash
# =============================================================================
# SecureBase — AWS Marketplace prod resource audit
# Usage:
#   BEFORE deploy:  ./marketplace_audit.sh > before.json
#   AFTER deploy:   ./marketplace_audit.sh > after.json
#   Diff:           diff <(jq . before.json) <(jq . after.json)
#
# Requires: aws CLI configured for account 731184206915, region us-east-1
# =============================================================================

set -euo pipefail

REGION="us-east-1"
ACCOUNT="731184206915"
ENV="production"
PRODUCT_CODE="blblyu28f6s5mzwl089d4xoea"
AWS="aws --region $REGION --output json"

snapshot() {
  local section="$1"; shift
  echo "\"$section\": $(eval "$@" 2>/dev/null || echo 'null')"
}

echo "{"

# ---------------------------------------------------------------------------
# Lambda functions — the three marketplace Lambdas
# ---------------------------------------------------------------------------
LAMBDA_NAMES=(
  "securebase-${ENV}-marketplace-resolve-customer"
  "securebase-${ENV}-marketplace-subscription-handler"
  "securebase-${ENV}-marketplace-metering-worker"
)

echo '"lambdas": {'
for fn in "${LAMBDA_NAMES[@]}"; do
  result=$($AWS lambda get-function --function-name "$fn" 2>/dev/null || echo 'null')
  # Extract just the key fields to keep output compact
  if [ "$result" != "null" ]; then
    summary=$(echo "$result" | jq '{
      FunctionName:        .Configuration.FunctionName,
      Runtime:             .Configuration.Runtime,
      State:               .Configuration.State,
      LastModified:        .Configuration.LastModified,
      CodeSize:            .Configuration.CodeSize,
      Timeout:             .Configuration.Timeout,
      MemorySize:          .Configuration.MemorySize,
      ProductCode:         .Configuration.Environment.Variables.MARKETPLACE_PRODUCT_CODE,
      VpcSubnets:          (.Configuration.VpcConfig.SubnetIds // []),
      VpcSecurityGroups:   (.Configuration.VpcConfig.SecurityGroupIds // []),
      CodeLocation:        .Code.Location
    }')
  else
    summary="null"
  fi
  echo "  \"${fn}\": ${summary},"
done
# close lambdas — trailing comma handled below
echo '"_lambdas_end": null},'

# ---------------------------------------------------------------------------
# SNS topics — internal subscription topic + subscription to AWS MP topic
# ---------------------------------------------------------------------------
INTERNAL_TOPIC="securebase-${ENV}-marketplace-subscriptions"
echo '"sns": {'

# Internal topic
internal_arn=$($AWS sns list-topics | jq -r ".Topics[].TopicArn | select(contains(\"$INTERNAL_TOPIC\"))" 2>/dev/null || echo "")
if [ -n "$internal_arn" ]; then
  attrs=$($AWS sns get-topic-attributes --topic-arn "$internal_arn" | jq '.Attributes | {TopicArn, DisplayName, SubscriptionsConfirmed, SubscriptionsPending, Policy: (.Policy | fromjson? // .Policy)}')
  subs=$($AWS sns list-subscriptions-by-topic --topic-arn "$internal_arn" | jq '[.Subscriptions[] | {Protocol, Endpoint, SubscriptionArn}]')
  echo "  \"internal_topic\": $(echo "$attrs" | jq --argjson subs "$subs" '. + {Subscriptions: $subs}'),"
else
  echo '  "internal_topic": null,'
fi

# AWS Marketplace SNS topic subscription (owned by AWS account 287250355862)
AWS_MP_TOPIC="arn:aws:sns:${REGION}:287250355862:aws-mp-subscription-notification-${PRODUCT_CODE}"
mp_sub=$($AWS sns list-subscriptions | jq "[.Subscriptions[] | select(.TopicArn == \"$AWS_MP_TOPIC\")]" 2>/dev/null || echo "[]")
echo "  \"aws_marketplace_topic_subscriptions\": ${mp_sub},"
echo '"_sns_end": null},'

# ---------------------------------------------------------------------------
# EventBridge rule — hourly metering trigger
# ---------------------------------------------------------------------------
RULE_NAME="securebase-${ENV}-marketplace-metering-hourly"
rule=$($AWS events describe-rule --name "$RULE_NAME" 2>/dev/null || echo 'null')
targets=$($AWS events list-targets-by-rule --rule "$RULE_NAME" 2>/dev/null | jq '.Targets' || echo '[]')
echo "\"eventbridge\": $(echo "$rule" | jq --argjson targets "$targets" '. + {Targets: $targets}' 2>/dev/null || echo 'null'),"

# ---------------------------------------------------------------------------
# CloudWatch alarms — one per Lambda
# ---------------------------------------------------------------------------
ALARM_PREFIXES=(
  "securebase-${ENV}-marketplace-metering-worker-errors"
  "securebase-${ENV}-marketplace-resolve-customer-errors"
  "securebase-${ENV}-marketplace-subscription-handler-errors"
)
echo '"cloudwatch_alarms": {'
for alarm in "${ALARM_PREFIXES[@]}"; do
  result=$($AWS cloudwatch describe-alarms --alarm-names "$alarm" | jq '.MetricAlarms[0] // null | if . then {AlarmName, StateValue, ActionsEnabled, AlarmActions, Dimensions, Threshold} else null end' 2>/dev/null || echo 'null')
  echo "  \"${alarm}\": ${result},"
done
echo '"_alarms_end": null},'

# ---------------------------------------------------------------------------
# S3 Lambda zips — verify the prod bucket has all three packages
# ---------------------------------------------------------------------------
PROD_BUCKET="securebase-terraform-state-prod"
ZIP_KEYS=(
  "lambda/marketplace_resolve_customer.zip"
  "lambda/marketplace-entitlement.zip"
  "lambda/marketplace-metering.zip"
)
echo '"s3_lambda_zips": {'
for key in "${ZIP_KEYS[@]}"; do
  result=$($AWS s3api head-object --bucket "$PROD_BUCKET" --key "$key" 2>/dev/null \
    | jq '{ContentLength, LastModified, ETag}' || echo 'null')
  echo "  \"${key}\": ${result},"
done
echo '"_s3_end": null},'

# ---------------------------------------------------------------------------
# Terraform state — check if marketplace module is tracked
# ---------------------------------------------------------------------------
STATE_BUCKET="securebase-terraform-state-prod"
STATE_KEY="landing-zone/terraform.tfstate"
echo '"terraform_state_marketplace_resources": '
$AWS s3 cp "s3://${STATE_BUCKET}/${STATE_KEY}" - 2>/dev/null \
  | jq '[.resources[] | select(.module == "module.marketplace[0]") | {type, name, mode}]' \
  || echo '[]'

echo '}'
