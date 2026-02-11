#!/bin/bash
# Test email sending via SQS

set -e

QUEUE_URL=$(cd infrastructure/email && terraform output -raw email_queue_url 2>/dev/null || echo "")

if [ -z "$QUEUE_URL" ]; then
  echo "❌ Error: Email queue not deployed. Run 'terraform apply' first."
  exit 1
fi

EMAIL_TO=${1:-"your-email@example.com"}

echo "📧 Sending test email to: $EMAIL_TO"
echo "   Queue: $QUEUE_URL"
echo ""

MESSAGE=$(cat <<JSON
{
  "type": "TEST",
  "to": "$EMAIL_TO",
  "subject": "Test from SecureBase by TxImhotep LLC",
  "html": "<h1>Hello!</h1><p>This is a test email from SecureBase.</p><p>If you're seeing this, your email infrastructure is working! 🎉</p>",
  "text": "Hello! This is a test email from SecureBase. If you're seeing this, your email infrastructure is working!",
  "replyTo": "support@tximhotep.com",
  "tags": [
    { "Name": "email_type", "Value": "test" },
    { "Name": "environment", "Value": "test" }
  ]
}
JSON
)

aws sqs send-message \
  --queue-url "$QUEUE_URL" \
  --message-body "$MESSAGE"

echo "✅ Message sent to queue!"
echo ""
echo "Check Lambda logs:"
echo "  aws logs tail /aws/lambda/securebase-email-worker --follow"
