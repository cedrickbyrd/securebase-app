# ── Phase 6 / Track 3: PagerDuty Integration ─────────────────────────────────
# PagerDuty Events API v2 integration via SNS → Lambda → PagerDuty
# API key stored in SSM Parameter Store (no secrets in code)

# ── SSM Parameter Store: PagerDuty API key ────────────────────────────────────

resource "aws_ssm_parameter" "pagerduty_api_key" {
  count = var.create_pagerduty_ssm_param ? 1 : 0

  name        = var.pagerduty_api_key_ssm_param
  description = "PagerDuty Events API v2 routing key for SecureBase ${var.environment}"
  type        = "SecureString"
  value       = var.pagerduty_routing_key != "" ? var.pagerduty_routing_key : "REPLACE_WITH_ACTUAL_KEY"
  key_id      = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/ssm"

  lifecycle {
    ignore_changes = [value]
  }

  tags = merge(local.common_tags, {
    Name    = "pagerduty-api-key"
    Purpose = "PagerDuty Events API v2 routing key"
  })
}

# ── SSM Parameter Store: Slack webhook URL ────────────────────────────────────

resource "aws_ssm_parameter" "slack_webhook" {
  count = var.create_slack_ssm_param ? 1 : 0

  name        = var.slack_webhook_ssm_param
  description = "Slack incoming webhook URL for SecureBase ${var.environment} alerts"
  type        = "SecureString"
  value       = var.slack_webhook_url != "" ? var.slack_webhook_url : "REPLACE_WITH_ACTUAL_URL"
  key_id      = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/ssm"

  lifecycle {
    ignore_changes = [value]
  }

  tags = merge(local.common_tags, {
    Name    = "slack-alert-webhook"
    Purpose = "Slack webhook for alert notifications"
  })
}

# ── Chaos Drill Lambda ────────────────────────────────────────────────────────

data "archive_file" "chaos_drill" {
  type        = "zip"
  source_file = "${path.root}/../src/lambdas/alerting/chaos_drill.py"
  output_path = "${path.module}/chaos_drill.zip"
}

resource "aws_lambda_function" "chaos_drill" {
  function_name    = "securebase-${var.environment}-chaos-drill"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "chaos_drill.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.chaos_drill.output_path
  source_code_hash = data.archive_file.chaos_drill.output_base64sha256
  timeout          = 600
  memory_size      = 256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      PAGERDUTY_SSM_PARAM  = var.pagerduty_api_key_ssm_param
      MAINTENANCE_PARAM    = "/securebase/${var.environment}/maintenance_mode"
      DRILL_RESULTS_BUCKET = var.runbook_s3_bucket
      SLACK_WEBHOOK_SSM    = var.slack_webhook_ssm_param
      LOG_LEVEL            = "INFO"
    }
  }

  tags = merge(local.common_tags, { Function = "chaos-drill" })
}

# ── EventBridge: monthly chaos drill schedule ─────────────────────────────────

resource "aws_cloudwatch_event_rule" "monthly_chaos_drill" {
  count = var.enable_chaos_drill_schedule ? 1 : 0

  name                = "securebase-${var.environment}-monthly-chaos-drill"
  description         = "Triggers monthly chaos/DR drill for SecureBase ${var.environment}"
  schedule_expression = var.chaos_drill_schedule

  tags = merge(local.common_tags, { Purpose = "chaos-drill" })
}

resource "aws_cloudwatch_event_target" "chaos_drill_lambda" {
  count = var.enable_chaos_drill_schedule ? 1 : 0

  rule      = aws_cloudwatch_event_rule.monthly_chaos_drill[0].name
  target_id = "chaos-drill-lambda"
  arn       = aws_lambda_function.chaos_drill.arn
  input     = jsonencode({ "action" = "full_drill", "source" = "scheduled" })
}

resource "aws_lambda_permission" "chaos_drill_eventbridge" {
  count = var.enable_chaos_drill_schedule ? 1 : 0

  statement_id  = "AllowEventBridgeChaosDrill"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chaos_drill.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_chaos_drill[0].arn
}

# ── IAM policy: least-privilege for all alerting Lambdas ─────────────────────

resource "aws_iam_policy" "alerting_lambdas" {
  name        = "securebase-${var.environment}-alerting-lambdas-policy"
  description = "Least-privilege policy for Phase 6 alerting Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SSMReadSecrets"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.pagerduty_api_key_ssm_param}",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.slack_webhook_ssm_param}",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/securebase/${var.environment}/maintenance_mode",
        ]
      },
      {
        Sid    = "SSMWriteMaintenanceMode"
        Effect = "Allow"
        Action = ["ssm:PutParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/securebase/${var.environment}/maintenance_mode",
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:DescribeKey"]
        Resource = var.kms_key_arn != "" ? [var.kms_key_arn] : ["*"]
        Condition = var.kms_key_arn != "" ? {} : {
          StringEquals = { "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com" }
        }
      },
      {
        Sid    = "S3RunbookRead"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.runbook_s3_bucket}",
          "arn:aws:s3:::${var.runbook_s3_bucket}/${var.runbook_s3_prefix}*",
        ]
      },
      {
        Sid    = "S3DrillResultsWrite"
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = ["arn:aws:s3:::${var.runbook_s3_bucket}/drill-results/*"]
      },
      {
        Sid    = "DynamoDBAlarmHistory"
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.alarm_history_table}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.alarm_history_table}/index/*",
        ]
      },
      {
        Sid    = "CloudWatchDescribeAlarms"
        Effect = "Allow"
        Action = ["cloudwatch:DescribeAlarms", "cloudwatch:GetMetricStatistics"]
        Resource = ["*"]
      },
      {
        Sid    = "LambdaThrottleSimulation"
        Effect = "Allow"
        Action = ["lambda:PutFunctionConcurrency"]
        Resource = [
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:securebase-${var.environment}-*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/securebase-${var.environment}-*"
        ]
      },
      {
        Sid    = "SNSPublishAlerts"
        Effect = "Allow"
        Action = ["sns:Publish"]
        Resource = [
          aws_sns_topic.p1_critical.arn,
          aws_sns_topic.p2_high.arn,
          aws_sns_topic.p3_medium.arn,
        ]
      },
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "alerting_lambdas" {
  role       = data.aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.alerting_lambdas.arn
}

# ── EventBridge rule: GuardDuty HIGH/CRITICAL findings → P1 SNS ───────────────

resource "aws_cloudwatch_event_rule" "guardduty_high_finding" {
  count = var.enable_security_alarms ? 1 : 0

  name        = "securebase-${var.environment}-guardduty-high-finding"
  description = "Routes GuardDuty HIGH/CRITICAL findings to P1 SNS topic"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7.0] }]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "guardduty_p1_sns" {
  count = var.enable_security_alarms ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_high_finding[0].name
  target_id = "guardduty-p1-sns"
  arn       = aws_sns_topic.p1_critical.arn
}

# ── EventBridge rule: AWS Health events ──────────────────────────────────────

resource "aws_cloudwatch_event_rule" "aws_health_critical" {
  name        = "securebase-${var.environment}-aws-health-critical"
  description = "Routes AWS Health service disruption events to P1 SNS"

  event_pattern = jsonencode({
    source      = ["aws.health"]
    detail-type = ["AWS Health Event"]
    detail = {
      eventTypeCategory = ["issue"]
      eventStatusCode   = ["open", "upcoming"]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "aws_health_p1_sns" {
  rule      = aws_cloudwatch_event_rule.aws_health_critical.name
  target_id = "aws-health-p1-sns"
  arn       = aws_sns_topic.p1_critical.arn
}
