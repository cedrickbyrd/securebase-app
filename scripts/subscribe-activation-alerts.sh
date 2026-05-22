#!/usr/bin/env bash
# subscribe-activation-alerts.sh
#
# One-shot script to subscribe an email address to the SecureBase customer
# activation SNS topic.  Use this when the topic already exists and you need
# to wire up the email subscription outside of Terraform.
#
# The SNS topic receives two event types published by the auth Lambda:
#   - invite_accepted  — customer accepts invite link and sets password
#   - first_login      — customer completes their first successful login
#
# Usage:
#   export TOPIC_ARN="arn:aws:sns:us-east-1:<ACCOUNT_ID>:securebase-production-customer-activations"
#   export EMAIL="cedrickjbyrd@me.com"
#   bash scripts/subscribe-activation-alerts.sh
#
# After running, AWS will send a confirmation email to $EMAIL.
# The subscription is PENDING until the recipient clicks "Confirm subscription".
#
# Required tools: aws CLI (authenticated with sns:Subscribe permission)

set -euo pipefail

# ── Validate inputs ───────────────────────────────────────────────────────────

if [[ -z "${TOPIC_ARN:-}" ]]; then
  echo "ERROR: TOPIC_ARN is not set."
  echo "  export TOPIC_ARN=arn:aws:sns:us-east-1:<ACCOUNT_ID>:securebase-production-customer-activations"
  exit 1
fi

if [[ -z "${EMAIL:-}" ]]; then
  echo "ERROR: EMAIL is not set."
  echo "  export EMAIL=you@example.com"
  exit 1
fi

# ── Subscribe ─────────────────────────────────────────────────────────────────

echo "Subscribing ${EMAIL} to ${TOPIC_ARN} ..."

SUBSCRIPTION_ARN=$(aws sns subscribe \
  --topic-arn  "${TOPIC_ARN}" \
  --protocol   email \
  --notification-endpoint "${EMAIL}" \
  --query SubscriptionArn \
  --output text)

echo ""
echo "✅  Subscription created: ${SUBSCRIPTION_ARN}"
echo ""
echo "⚠️  ACTION REQUIRED — AWS has sent a confirmation email to: ${EMAIL}"
echo "    The subscription is PENDING until the recipient clicks"
echo "    'Confirm subscription' in that email."
echo ""
echo "To verify the subscription status:"
echo "  aws sns get-subscription-attributes --subscription-arn '${SUBSCRIPTION_ARN}'"
echo ""
echo "Or list all subscriptions on the topic:"
echo "  aws sns list-subscriptions-by-topic --topic-arn '${TOPIC_ARN}'"
