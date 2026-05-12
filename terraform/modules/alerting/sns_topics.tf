# ── Phase 6 / Track 3: Alerting & Incident Response ──────────────────────────
# SNS Topics with P1/P2/P3 severity routing
# P1 — page immediately (critical, production-impacting)
# P2 — page in 5 minutes (high severity, degraded service)
# P3 — create ticket only (medium/informational)

locals {
  common_tags = merge(var.tags, {
    Phase               = "6.3"
    Component           = "AlertingIncidentResponse"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    ManagedBy           = "terraform"
  })
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── P1 Topic: Critical / Page Immediately ────────────────────────────────────

resource "aws_sns_topic" "p1_critical" {
  name              = "securebase-${var.environment}-alerts-p1-critical"
  kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Name     = "securebase-${var.environment}-alerts-p1-critical"
    Severity = "P1"
  })
}

resource "aws_sns_topic_subscription" "p1_email" {
  count     = var.p1_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.p1_critical.arn
  protocol  = "email"
  endpoint  = var.p1_email
}

resource "aws_sns_topic_subscription" "p1_oncall_email" {
  count     = var.oncall_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.p1_critical.arn
  protocol  = "email"
  endpoint  = var.oncall_email
}

# ── P2 Topic: High Severity / Page in 5 Minutes ──────────────────────────────

resource "aws_sns_topic" "p2_high" {
  name              = "securebase-${var.environment}-alerts-p2-high"
  kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Name     = "securebase-${var.environment}-alerts-p2-high"
    Severity = "P2"
  })
}

resource "aws_sns_topic_subscription" "p2_email" {
  count     = var.p2_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.p2_high.arn
  protocol  = "email"
  endpoint  = var.p2_email
}

# ── P3 Topic: Medium / Ticket Only ────────────────────────────────────────────

resource "aws_sns_topic" "p3_medium" {
  name              = "securebase-${var.environment}-alerts-p3-medium"
  kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Name     = "securebase-${var.environment}-alerts-p3-medium"
    Severity = "P3"
  })
}

resource "aws_sns_topic_subscription" "p3_email" {
  count     = var.p3_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.p3_medium.arn
  protocol  = "email"
  endpoint  = var.p3_email
}

# ── Runbook Executor Lambda subscription (P1 + P2) ────────────────────────────

data "archive_file" "runbook_executor" {
  type        = "zip"
  source_file = "${path.root}/../src/lambdas/alerting/runbook_executor.py"
  output_path = "${path.module}/runbook_executor.zip"
}

data "archive_file" "alarm_aggregator" {
  type        = "zip"
  source_file = "${path.root}/../src/lambdas/alerting/alarm_aggregator.py"
  output_path = "${path.module}/alarm_aggregator.zip"
}

data "aws_iam_role" "lambda_exec" {
  name = "securebase_lambda_exec_role"
}

resource "aws_lambda_function" "runbook_executor" {
  function_name    = "securebase-${var.environment}-runbook-executor"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "runbook_executor.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.runbook_executor.output_path
  source_code_hash = data.archive_file.runbook_executor.output_base64sha256
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      RUNBOOK_BUCKET       = var.runbook_s3_bucket
      RUNBOOK_PREFIX       = var.runbook_s3_prefix
      PAGERDUTY_SSM_PARAM  = var.pagerduty_api_key_ssm_param
      SLACK_WEBHOOK_SSM    = var.slack_webhook_ssm_param
      MAINTENANCE_PARAM    = "/securebase/${var.environment}/maintenance_mode"
      LOG_LEVEL            = "INFO"
    }
  }

  tags = merge(local.common_tags, { Function = "runbook-executor" })
}

resource "aws_lambda_function" "alarm_aggregator" {
  function_name    = "securebase-${var.environment}-alarm-aggregator"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "alarm_aggregator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.alarm_aggregator.output_path
  source_code_hash = data.archive_file.alarm_aggregator.output_base64sha256
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      DYNAMODB_TABLE    = var.alarm_history_table
      LOG_LEVEL         = "INFO"
    }
  }

  tags = merge(local.common_tags, { Function = "alarm-aggregator" })
}

# Lambda permissions for SNS invocations
resource "aws_lambda_permission" "runbook_p1" {
  statement_id  = "AllowSNSP1Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.runbook_executor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.p1_critical.arn
}

resource "aws_lambda_permission" "runbook_p2" {
  statement_id  = "AllowSNSP2Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.runbook_executor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.p2_high.arn
}

resource "aws_lambda_permission" "aggregator_p1" {
  statement_id  = "AllowSNSAggregatorP1"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alarm_aggregator.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.p1_critical.arn
}

resource "aws_lambda_permission" "aggregator_p2" {
  statement_id  = "AllowSNSAggregatorP2"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alarm_aggregator.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.p2_high.arn
}

resource "aws_lambda_permission" "aggregator_p3" {
  statement_id  = "AllowSNSAggregatorP3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alarm_aggregator.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.p3_medium.arn
}

resource "aws_sns_topic_subscription" "runbook_executor_p1" {
  topic_arn = aws_sns_topic.p1_critical.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.runbook_executor.arn
}

resource "aws_sns_topic_subscription" "runbook_executor_p2" {
  topic_arn = aws_sns_topic.p2_high.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.runbook_executor.arn
}

resource "aws_sns_topic_subscription" "alarm_aggregator_p1" {
  topic_arn = aws_sns_topic.p1_critical.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alarm_aggregator.arn
}

resource "aws_sns_topic_subscription" "alarm_aggregator_p2" {
  topic_arn = aws_sns_topic.p2_high.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alarm_aggregator.arn
}

resource "aws_sns_topic_subscription" "alarm_aggregator_p3" {
  topic_arn = aws_sns_topic.p3_medium.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alarm_aggregator.arn
}

# ── SNS policies to allow CloudWatch and EventBridge to publish ───────────────

resource "aws_sns_topic_policy" "p1_allow_cloudwatch" {
  arn = aws_sns_topic.p1_critical.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchPublish"
        Effect = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p1_critical.arn
      },
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p1_critical.arn
      },
    ]
  })
}

resource "aws_sns_topic_policy" "p2_allow_cloudwatch" {
  arn = aws_sns_topic.p2_high.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchPublish"
        Effect = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p2_high.arn
      },
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p2_high.arn
      },
    ]
  })
}

resource "aws_sns_topic_policy" "p3_allow_cloudwatch" {
  arn = aws_sns_topic.p3_medium.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchPublish"
        Effect = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p3_medium.arn
      },
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.p3_medium.arn
      },
    ]
  })
}

# ── DynamoDB: alarm history table ─────────────────────────────────────────────

resource "aws_dynamodb_table" "alarm_history" {
  name         = var.alarm_history_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "alarm_name"
  range_key    = "triggered_at"

  attribute {
    name = "alarm_name"
    type = "S"
  }

  attribute {
    name = "triggered_at"
    type = "S"
  }

  attribute {
    name = "severity"
    type = "S"
  }

  global_secondary_index {
    name            = "severity-triggered-index"
    hash_key        = "severity"
    range_key       = "triggered_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name    = var.alarm_history_table
    Purpose = "CloudWatch alarm history for MTTA/MTTR tracking"
  })
}
