#!/usr/bin/env bash
# Phase 5.4 DR Validation Script
# Usage: ./dr-validation.sh [prod|dev]

set -euo pipefail
ENV=${1:-prod}
PRIMARY_REGION="us-east-1"
SECONDARY_REGION="us-west-2"
PASS=0; FAIL=0

check() {
  local label=$1; local cmd=$2
  if eval "$cmd" &>/dev/null; then
    echo "✅ $label"; ((PASS++))
  else
    echo "❌ $label"; ((FAIL++))
  fi
}

echo "=== SecureBase Phase 5.4 DR Validation (${ENV}) ==="

# 1. Aurora Global Cluster exists
check "Aurora Global Cluster exists" \
  "aws rds describe-global-clusters --query 'GlobalClusters[?contains(GlobalClusterIdentifier,\`securebase-${ENV}\`)]' --output text | grep -q securebase"

# 2. Secondary Aurora cluster is available
check "Secondary Aurora cluster available (us-west-2)" \
  "aws rds describe-db-clusters --region $SECONDARY_REGION --query 'DBClusters[?contains(DBClusterIdentifier,\`secondary\`)].[Status]' --output text | grep -q available"

# 3. DynamoDB replicas exist in us-west-2
check "DynamoDB global tables replicated to us-west-2" \
  "aws dynamodb list-tables --region $SECONDARY_REGION --output text | grep -q securebase"

# 4. S3 replication rule enabled
check "S3 audit log replication rule active" \
  "aws s3api get-bucket-replication --bucket securebase-${ENV}-audit-logs --query 'ReplicationConfiguration.Rules[0].Status' --output text | grep -q Enabled"

# 5. Route53 health check passing
check "Route53 primary health check healthy" \
  "aws route53 get-health-check-status --health-check-id \$(aws route53 list-health-checks --query 'HealthChecks[?contains(HealthCheckConfig.FullyQualifiedDomainName,\`primary\`)].[Id]' --output text | head -1) --query 'HealthCheckObservations[0].StatusReport.Status' --output text | grep -q Success"

# 6. Secondary health endpoint reachable
HEALTH_URL=$(aws apigatewayv2 get-apis --region $SECONDARY_REGION \
  --query "Items[?contains(Name,\`health-secondary\`)].[ApiEndpoint]" \
  --output text 2>/dev/null | head -1)
check "Secondary /health endpoint reachable" \
  "curl -sf --max-time 5 ${HEALTH_URL}/health | grep -q healthy"

# 7. Lambda function exists in secondary region
check "Health Lambda deployed to us-west-2" \
  "aws lambda get-function --function-name securebase-${ENV}-health-secondary --region $SECONDARY_REGION"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[[ $FAIL -eq 0 ]] && echo "✅ DR stack validated" && exit 0 || exit 1
