#!/bin/bash
# SecureBase Payment Workflow Verification
# Tests complete customer signup and payment processing flow

VERIFICATION_RUN_ID=$(date +%Y%m%d-%H%M%S)
TEST_EMAIL_ADDRESS="workflow-test-${VERIFICATION_RUN_ID}@securebase.test"
TEST_COMPANY_NAME="Workflow Verification ${VERIFICATION_RUN_ID}"
SELECTED_TIER="fintech"

display_header() {
  cat << 'HEADER'

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     SecureBase Payment Workflow Verification Tool             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

HEADER
}

execute_checkout_creation() {
  local api_gateway_url="${API_BASE_URL:-https://api.securebase.dev}"
  local checkout_endpoint="${api_gateway_url}/checkout"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Stage 1: Checkout Session Creation"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Parameters:"
  echo "  • Organization: ${TEST_COMPANY_NAME}"
  echo "  • Contact: ${TEST_EMAIL_ADDRESS}"
  echo "  • Subscription: ${SELECTED_TIER}"
  echo "  • Pilot discount: Yes"
  echo ""
  
  local request_payload=$(cat <<PAYLOAD
{
  "tier": "${SELECTED_TIER}",
  "email": "${TEST_EMAIL_ADDRESS}",
  "name": "${TEST_COMPANY_NAME}",
  "use_pilot_coupon": true
}
PAYLOAD
)
  
  local api_response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "${checkout_endpoint}" \
    -H "Content-Type: application/json" \
    --data "${request_payload}")
  
  local response_body=$(echo "${api_response}" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
  local response_status=$(echo "${api_response}" | grep "HTTP_STATUS:" | cut -d: -f2)
  
  if [ "${response_status}" != "200" ]; then
    echo "❌ Checkout creation failed with status ${response_status}"
    echo ""
    echo "Response:"
    echo "${response_body}" | jq . 2>/dev/null || echo "${response_body}"
    return 1
  fi
  
  CHECKOUT_SESSION_ID=$(echo "${response_body}" | jq -r '.session_id // empty')
  CHECKOUT_PAYMENT_URL=$(echo "${response_body}" | jq -r '.checkout_url // empty')
  
  if [ -z "${CHECKOUT_SESSION_ID}" ]; then
    echo "❌ Session ID not found in response"
    return 1
  fi
  
  echo "✅ Checkout session created successfully"
  echo ""
  echo "Session details:"
  echo "  • ID: ${CHECKOUT_SESSION_ID}"
  echo "  • URL: ${CHECKOUT_PAYMENT_URL}"
  echo ""
  
  return 0
}

prompt_for_payment_completion() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Stage 2: Payment Processing (Manual)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "⚠️  MANUAL ACTION REQUIRED"
  echo ""
  echo "1. Navigate to the payment URL:"
  echo "   ${CHECKOUT_PAYMENT_URL}"
  echo ""
  echo "2. Complete checkout using test card:"
  echo "   Number: 4242 4242 4242 4242"
  echo "   Expiry: 12/34"
  echo "   CVC:    123"
  echo "   Postal: 12345"
  echo ""
  echo -n "→ Press ENTER after completing payment: "
  read -r user_input
  echo ""
}

wait_for_webhook_delivery() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Stage 3: Webhook Processing Delay"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Allowing time for webhook delivery and processing..."
  echo ""
  
  local wait_seconds=12
  while [ ${wait_seconds} -gt 0 ]; do
    printf "  ⏳ %2ds remaining\r" ${wait_seconds}
    sleep 1
    wait_seconds=$((wait_seconds - 1))
  done
  
  echo "  ✓ Processing delay complete          "
  echo ""
}

query_customer_database() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Stage 4: Database Verification"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  if [ -z "${DATABASE_URL}" ]; then
    echo "❌ DATABASE_URL environment variable not defined"
    echo ""
    echo "Cannot verify database integration without connection string."
    return 1
  fi
  
  echo "Querying customer record..."
  echo ""
  
  local db_query="
    SELECT 
      name,
      email,
      tier,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id
    FROM customers
    WHERE email = '${TEST_EMAIL_ADDRESS}'
    LIMIT 1;
  "
  
  local query_output=$(psql "${DATABASE_URL}" -t -c "${db_query}" 2>&1)
  local query_exit_code=$?
  
  if [ ${query_exit_code} -ne 0 ]; then
    echo "❌ Database query execution failed"
    echo ""
    echo "Error output:"
    echo "${query_output}"
    return 1
  fi
  
  # Check if result is empty
  if [ -z "$(echo "${query_output}" | tr -d '[:space:]')" ]; then
    echo "❌ No customer record found for ${TEST_EMAIL_ADDRESS}"
    echo ""
    echo "Possible causes:"
    echo "  • Webhook was not delivered"
    echo "  • Webhook processing failed"
    echo "  • Database connection issue"
    return 1
  fi
  
  echo "✅ Customer record located"
  echo ""
  echo "Record data:"
  echo "${query_output}" | sed 's/^/  /'
  echo ""
  
  # Extract and validate Stripe identifiers
  local stripe_customer=$(echo "${query_output}" | awk '{print $5}')
  local stripe_subscription=$(echo "${query_output}" | awk '{print $6}')
  
  echo "Validating Stripe identifiers..."
  
  if [[ "${stripe_customer}" =~ ^cus_[a-zA-Z0-9]+ ]]; then
    echo "  ✓ Customer ID format valid: ${stripe_customer}"
  else
    echo "  ✗ Customer ID format invalid: ${stripe_customer}"
    return 1
  fi
  
  if [[ "${stripe_subscription}" =~ ^sub_[a-zA-Z0-9]+ ]]; then
    echo "  ✓ Subscription ID format valid: ${stripe_subscription}"
  else
    echo "  ✗ Subscription ID format invalid: ${stripe_subscription}"
    return 1
  fi
  
  echo ""
  return 0
}

display_verification_summary() {
  local final_status=$1
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Verification Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  if [ ${final_status} -eq 0 ]; then
    cat << 'SUCCESS'
✅ VERIFICATION SUCCESSFUL

All workflow stages completed:
  ✓ API checkout session created
  ✓ Stripe payment processed
  ✓ Webhook delivered and processed
  ✓ Database record created and validated
  ✓ Stripe identifiers properly stored

Test account details:
SUCCESS
    echo "  Email: ${TEST_EMAIL_ADDRESS}"
    echo ""
    echo "Next recommended actions:"
    echo "  • Review CloudWatch logs for webhook details"
    echo "  • Confirm SNS notification delivery"
    echo "  • Test portal access with this account"
    echo "  • Remove test subscription from Stripe"
  else
    cat << 'FAILURE'
❌ VERIFICATION FAILED

Review the errors above and investigate:
  • API Gateway endpoint configuration
  • Lambda function status and logs
  • Webhook endpoint configuration in Stripe
  • Database connectivity and schema
  • CloudWatch logs for detailed errors
FAILURE
  fi
  
  echo ""
}

execute_verification_workflow() {
  display_header
  
  if ! execute_checkout_creation; then
    display_verification_summary 1
    exit 1
  fi
  
  prompt_for_payment_completion
  wait_for_webhook_delivery
  
  if ! query_customer_database; then
    display_verification_summary 1
    exit 1
  fi
  
  display_verification_summary 0
  exit 0
}

# Run verification workflow
execute_verification_workflow
