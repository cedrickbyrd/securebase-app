# ── Phase 5.3: Alerting & Incident Response ────────────────────────────────────
# Authoritative alarm definitions live in separate files:
#   alarms-lambda.tf   — per-Lambda errors, throttles, duration, auth/provisioner
#   alarms-api.tf      — API Gateway 5xx, 4xx, latency, CloudFront cache hit rate
#   alarms-database.tf — Aurora, DynamoDB
#   alarms-cache.tf    — ElastiCache
#   alarms-composite.tf— composite alarms
#
# This file owns: SNS topic, alert router Lambda, lambda_concurrent alarm,
# and Aurora CPU alarm. Do NOT add alarm resources here that already exist
# in the dedicated alarm files — Terraform will reject duplicate resource names.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── SNS alert topic ────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "securebase-${var.environment}-alerts"
  kms_master_key_id = var.sns_kms_key_arn != "" ? var.sns_kms_key_arn : "alias/aws/sns"

  tags = merge(var.tags, {
    Name  = "securebase-${var.environment}-alerts"
    Phase = "5.3"
  })
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "oncall_email" {
  count     = var.oncall_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.oncall_email
}

# ── Alert Router Lambda ────────────────────────────────────────────────────────────

data "aws_iam_role" "lambda_exec" {
  name = "securebase_lambda_exec_role"
}

data "archive_file" "alert_router" {
  type        = "zip"
  source_file = "${path.module}/../../../phase2-backend/functions/alert_router.py"
  output_path = "${path.module}/alert_router.zip"
}

resource "aws_lambda_function" "alert_router" {
  function_name    = "securebase-${var.environment}-alert-router"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "alert_router.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.alert_router.output_path
  source_code_hash = data.archive_file.alert_router.output_base64sha256
  timeout          = 30
  memory_size      = 128
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT            = var.environment
      SNS_TOPIC_ARN          = aws_sns_topic.alerts.arn
      ALERT_WEBHOOK_SSM      = var.alert_webhook_ssm_param
      MAINTENANCE_MODE_PARAM = aws_ssm_parameter.maintenance_mode.name
      PAGERDUTY_ROUTING_KEY  = var.pagerduty_routing_key
    }
  }

  tags = merge(var.tags, { Phase = "5.3" })
}

resource "aws_lambda_permission" "sns_invoke_alert_router" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_router.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alerts.arn
}

resource "aws_sns_topic_subscription" "alert_router_lambda" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alert_router.arn
}

# ── CloudWatch alarm: account-wide Lambda concurrency ───────────────────────────
# Per-function alarms (lambda_errors, lambda_throttles, lambda_duration) live
# in alarms-lambda.tf — this is the one account-level concurrency alarm.

resource "aws_cloudwatch_metric_alarm" "lambda_concurrent" {
  alarm_name          = "securebase-${var.environment}-lambda-concurrent-executions"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.lambda_concurrency_threshold
  alarm_description   = "Account-wide Lambda concurrency >= ${var.lambda_concurrency_threshold}"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# ── CloudWatch alarm: Aurora CPU ────────────────────────────────────────────────────────
# Additional Aurora alarms (connections, replica lag, deadlocks, memory,
# storage) live in alarms-database.tf.

resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Aurora cluster ${var.aurora_cluster_id} CPU >= 80%"
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}
