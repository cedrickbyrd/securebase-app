#!/bin/bash

# ============================================
# Deploy Pilot Customer Signup Workflow
# ============================================
# Deploys all components for self-service signup
#
# Usage: ./deploy-signup-workflow.sh [--env dev|staging|prod]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV="${1:-dev}"

# Lambda function names
CHECKOUT_FUNCTION="securebase-${ENV}-create-checkout-session"
WEBHOOK_FUNCTION="securebase-${ENV}-stripe-webhook"
ONBOARDING_FUNCTION="securebase-${ENV}-trigger-onboarding"

# DynamoDB table
RATE_LIMIT_TABLE="securebase-${ENV}-signup-rate-limits"

# ============================================
# FUNCTIONS
# ============================================

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  echo -e "${YELLOW}▶${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
  exit 1
}

check_prerequisites() {
  print_step "Checking prerequisites..."
  
  # Check AWS CLI
  if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found"
  fi
  
  # Check jq
  if ! command -v jq &> /dev/null; then
    print_error "jq not found"
  fi
  
  # Check AWS credentials
  if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured"
  fi
  
  print_success "Prerequisites met"
}

run_database_migration() {
  print_step "Running database migration..."
  
  # Get database credentials from Secrets Manager
  DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "securebase/${ENV}/database" \
    --query SecretString \
    --output text)
  
  DB_HOST=$(echo $DB_SECRET | jq -r '.host')
  DB_USER=$(echo $DB_SECRET | jq -r '.username')
  DB_NAME=$(echo $DB_SECRET | jq -r '.database')
  
  # Run migration
  PGPASSWORD=$(echo $DB_SECRET | jq -r '.password') \
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -f "${SCRIPT_DIR}/phase2-backend/database/migrations/001_add_stripe_fields.sql"
  
  print_success "Database migration complete"
}

create_rate_limit_table() {
  print_step "Creating DynamoDB rate limit table..."
  
  # Check if table exists
  if aws dynamodb describe-table \
    --table-name "$RATE_LIMIT_TABLE" &> /dev/null; then
    print_success "Rate limit table already exists"
    return
  fi
  
  # Create table
  aws dynamodb create-table \
    --table-name "$RATE_LIMIT_TABLE" \
    --attribute-definitions \
      AttributeName=ip_hash,AttributeType=S \
    --key-schema \
      AttributeName=ip_hash,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags Key=Environment,Value="$ENV" Key=Component,Value=signup-rate-limiting
  
  # Enable TTL
  aws dynamodb update-time-to-live \
    --table-name "$RATE_LIMIT_TABLE" \
    --time-to-live-specification Enabled=true,AttributeName=ttl
  
  print_success "Rate limit table created"
}

package_lambda_functions() {
  print_step "Packaging Lambda functions..."
  
  cd "${SCRIPT_DIR}/phase2-backend/functions"
  
  # Create deploy directory
  mkdir -p ../deploy
  
  # Package create_checkout_session
  zip -q ../deploy/create_checkout_session.zip create_checkout_session.py
  print_success "Packaged create_checkout_session"
  
  # Package stripe_webhook
  zip -q ../deploy/stripe_webhook.zip stripe_webhook.py
  print_success "Packaged stripe_webhook"
  
  # Package trigger_onboarding
  zip -q ../deploy/trigger_onboarding.zip trigger_onboarding.py
  print_success "Packaged trigger_onboarding"
  
  cd "$SCRIPT_DIR"
}

deploy_lambda_functions() {
  print_step "Deploying Lambda functions..."
  
  # Deploy create_checkout_session
  aws lambda update-function-code \
    --function-name "$CHECKOUT_FUNCTION" \
    --zip-file "fileb://${SCRIPT_DIR}/phase2-backend/deploy/create_checkout_session.zip" \
    > /dev/null
  print_success "Deployed create_checkout_session"
  
  # Deploy stripe_webhook
  aws lambda update-function-code \
    --function-name "$WEBHOOK_FUNCTION" \
    --zip-file "fileb://${SCRIPT_DIR}/phase2-backend/deploy/stripe_webhook.zip" \
    > /dev/null
  print_success "Deployed stripe_webhook"
  
  # Deploy trigger_onboarding
  aws lambda update-function-code \
    --function-name "$ONBOARDING_FUNCTION" \
    --zip-file "fileb://${SCRIPT_DIR}/phase2-backend/deploy/trigger_onboarding.zip" \
    > /dev/null
  print_success "Deployed trigger_onboarding"
}

update_environment_variables() {
  print_step "Updating Lambda environment variables..."
  
  # Get Stripe keys from Secrets Manager
  STRIPE_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "securebase/${ENV}/stripe" \
    --query SecretString \
    --output text)
  
  STRIPE_SECRET_KEY=$(echo $STRIPE_SECRET | jq -r '.secret_key')
  STRIPE_WEBHOOK_SECRET=$(echo $STRIPE_SECRET | jq -r '.webhook_secret')
  STRIPE_PILOT_COUPON=$(echo $STRIPE_SECRET | jq -r '.pilot_coupon')
  
  # Get price IDs
  STRIPE_PRICE_STANDARD=$(echo $STRIPE_SECRET | jq -r '.price_standard')
  STRIPE_PRICE_FINTECH=$(echo $STRIPE_SECRET | jq -r '.price_fintech')
  STRIPE_PRICE_HEALTHCARE=$(echo $STRIPE_SECRET | jq -r '.price_healthcare')
  STRIPE_PRICE_GOVERNMENT=$(echo $STRIPE_SECRET | jq -r '.price_government')
  
  # Determine portal URL based on environment
  if [ "$ENV" = "prod" ]; then
    PORTAL_URL="https://portal.securebase.io"
  elif [ "$ENV" = "staging" ]; then
    PORTAL_URL="https://portal-staging.securebase.io"
  else
    PORTAL_URL="https://portal-dev.securebase.io"
  fi
  
  # Update create_checkout_session
  aws lambda update-function-configuration \
    --function-name "$CHECKOUT_FUNCTION" \
    --environment "Variables={
      STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},
      STRIPE_PRICE_STANDARD=${STRIPE_PRICE_STANDARD},
      STRIPE_PRICE_FINTECH=${STRIPE_PRICE_FINTECH},
      STRIPE_PRICE_HEALTHCARE=${STRIPE_PRICE_HEALTHCARE},
      STRIPE_PRICE_GOVERNMENT=${STRIPE_PRICE_GOVERNMENT},
      STRIPE_PILOT_COUPON=${STRIPE_PILOT_COUPON},
      PORTAL_URL=${PORTAL_URL},
      RATE_LIMIT_TABLE=${RATE_LIMIT_TABLE}
    }" \
    > /dev/null
  print_success "Updated create_checkout_session environment"
  
  # Update stripe_webhook
  SNS_TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn, 'securebase-${ENV}-notifications')].TopicArn" --output text)
  
  aws lambda update-function-configuration \
    --function-name "$WEBHOOK_FUNCTION" \
    --environment "Variables={
      STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},
      STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET},
      SNS_TOPIC_ARN=${SNS_TOPIC_ARN},
      ONBOARDING_FUNCTION_NAME=${ONBOARDING_FUNCTION}
    }" \
    > /dev/null
  print_success "Updated stripe_webhook environment"
  
  # Update trigger_onboarding
  aws lambda update-function-configuration \
    --function-name "$ONBOARDING_FUNCTION" \
    --environment "Variables={
      SES_SENDER_EMAIL=noreply@securebase.io,
      SNS_TOPIC_ARN=${SNS_TOPIC_ARN},
      PORTAL_URL=${PORTAL_URL}
    }" \
    > /dev/null
  print_success "Updated trigger_onboarding environment"
}

run_tests() {
  print_step "Running tests..."
  
  # Run integration tests
  python3 "${SCRIPT_DIR}/tests/integration/test_signup_flow.py"
  print_success "Integration tests passed"
  
  # Run E2E tests
  python3 "${SCRIPT_DIR}/tests/e2e/test_pilot_signup.py"
  print_success "E2E tests passed"
}

display_summary() {
  print_header "Deployment Complete! 🎉"
  
  echo "Environment: ${ENV}"
  echo ""
  echo "Lambda Functions:"
  echo "  - ${CHECKOUT_FUNCTION}"
  echo "  - ${WEBHOOK_FUNCTION}"
  echo "  - ${ONBOARDING_FUNCTION}"
  echo ""
  echo "DynamoDB Table:"
  echo "  - ${RATE_LIMIT_TABLE}"
  echo ""
  echo "Next Steps:"
  echo "  1. Configure Stripe webhook endpoint"
  echo "  2. Test signup flow in ${ENV} environment"
  echo "  3. Monitor CloudWatch logs"
  echo ""
  echo "Documentation:"
  echo "  - ${SCRIPT_DIR}/docs/SIGNUP_WORKFLOW.md"
  echo ""
}

# ============================================
# MAIN EXECUTION
# ============================================

main() {
  print_header "Deploy Pilot Customer Signup Workflow"
  echo "Environment: ${ENV}"
  
  # Check prerequisites
  check_prerequisites
  
  # Database migration
  if [ "${SKIP_DB:-false}" != "true" ]; then
    run_database_migration
  fi
  
  # Create DynamoDB table
  create_rate_limit_table
  
  # Package Lambda functions
  package_lambda_functions
  
  # Deploy Lambda functions
  deploy_lambda_functions
  
  # Update environment variables
  update_environment_variables
  
  # Run tests
  if [ "${SKIP_TESTS:-false}" != "true" ]; then
    run_tests
  fi
  
  # Display summary
  display_summary
}

# Run main
main
