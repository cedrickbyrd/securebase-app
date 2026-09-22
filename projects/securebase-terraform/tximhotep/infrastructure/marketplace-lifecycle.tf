# 1. EventBridge Rule to capture all active Marketplace adjustments
resource "aws_cloudwatch_event_rule" "marketplace_lifecycle" {
  name        = "securebase-marketplace-lifecycle"
  description = "Captures AWS Marketplace subscription updates, entitlements, and cancellations"

  event_pattern = jsonencode({
    "source": ["aws.marketplace"],
    "detail-type": [
      "AWS Marketplace Product Subscription Status Analytical Notification",
      "AWS Marketplace Agreement Status Change"
    ]
  })
}

# 2. IAM Role to allow EventBridge to make outbound HTTPS calls to your endpoint
resource "aws_iam_role" "eventbridge_invocation" {
  name = "securebase-eventbridge-webhook-invocation"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

# 3. Connection Authorization (Can hold custom API keys or Basic Auth headers if required)
resource "aws_cloudwatch_event_connection" "backend_auth" {
  name               = "securebase-backend-connection"
  description        = "Authentication credentials for SecureBase Netlify API webhooks"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "x-securebase-webhook-token"
      value = "sb_live_secure_handshake_secret_2026" # Change to an environment variable or secret reference
    }
  }
}

# 4. Target Destination (Points directly to your app's deployment domain endpoint)
resource "aws_cloudwatch_event_api_destination" "backend_webhook" {
  name                             = "securebase-backend-webhook-destination"
  description                      = "SecureBase production API endpoint for marketplace webhooks"
  connection_arn                   = aws_cloudwatch_event_connection.backend_auth.arn
  invocation_endpoint              = "https://app.securebaseposture.com/api/v1/marketplace/webhook" # Swap with your true Netlify base domain
  http_method                      = "POST"
  invocation_rate_limit_per_second = 10
}

# 5. Link the Rule to the API Target
resource "aws_cloudwatch_event_target" "webhook_target" {
  rule      = aws_cloudwatch_event_rule.marketplace_lifecycle.name
  target_id = "SecureBaseBackendWebhook"
  arn       = aws_cloudwatch_event_api_destination.backend_webhook.arn
  role_arn  = aws_iam_role.eventbridge_invocation.arn
}
