# ── Alert Router: dedicated IAM policy (least-privilege) ──────────────────────

resource "aws_iam_policy" "alert_router" {
  name        = "securebase-${var.environment}-alert-router-policy"
  description = "Least-privilege policy for alert_router Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadWebhookSSM"
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.alert_webhook_ssm_param}"
        ]
      },
      {
        Sid    = "DecryptSSMKMS"
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        Resource = [
          var.alert_webhook_kms_key_arn != "" ? var.alert_webhook_kms_key_arn : "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"
        ]
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/securebase-${var.environment}-alert-router:*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "alert_router" {
  role       = data.aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.alert_router.arn
}

# ── SSM Parameter placeholder for webhook URL (populated by ops team) ─────────

resource "aws_ssm_parameter" "webhook_url" {
  count = var.create_webhook_ssm_param ? 1 : 0

  name        = var.alert_webhook_ssm_param
  type        = "SecureString"
  value       = var.initial_webhook_url != "" ? var.initial_webhook_url : "REPLACE_WITH_ACTUAL_WEBHOOK_URL"
  description = "PagerDuty/Opsgenie/Slack webhook URL for SecureBase ${var.environment} alerts"
  overwrite   = false

  lifecycle {
    ignore_changes = [value]
  }

  tags = local.common_tags
}

# ── Dead-Letter Queue for failed alert deliveries ──────────────────────────────

resource "aws_sqs_queue" "alert_router_dlq" {
  name                      = "securebase-${var.environment}-alert-router-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.sns_kms_key_arn != "" ? var.sns_kms_key_arn : "alias/aws/sqs"

  tags = local.common_tags
}

resource "aws_lambda_function_event_invoke_config" "alert_router_dlq" {
  function_name = aws_lambda_function.alert_router.function_name

  destination_config {
    on_failure {
      destination = aws_sqs_queue.alert_router_dlq.arn
    }
  }

  maximum_retry_attempts = 2
}

# ── CloudWatch alarm: DLQ depth (failed alert deliveries) ─────────────────────

resource "aws_cloudwatch_metric_alarm" "alert_router_dlq_depth" {
  alarm_name          = "securebase-${var.environment}-alert-router-dlq-depth"
  alarm_description   = "Alert router DLQ has messages — webhook deliveries failing"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { QueueName = aws_sqs_queue.alert_router_dlq.name }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "high" })
}
