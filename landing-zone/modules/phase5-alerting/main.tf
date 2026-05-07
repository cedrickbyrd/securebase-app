# ── Phase 5.3: Alerting & Incident Response ───────────────────────────────────
# Delivers:
#   - SNS alerts topic (KMS-encrypted)
#   - Alert Router Lambda (routes to PagerDuty / email)
#   - CloudWatch alarms: Lambda errors, throttles, concurrency
#   - CloudWatch alarms: API Gateway 5xx, P99 latency
#   - CloudWatch alarms: Aurora CPU

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── SNS alert topic ───────────────────────────────────────────────────────────

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

# ── Alert Router Lambda ───────────────────────────────────────────────────────

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

  environment {
    variables = {
      ENVIRONMENT           = var.environment
      SNS_TOPIC_ARN         = aws_sns_topic.alerts.arn
      ALERT_WEBHOOK_SSM     = var.alert_webhook_ssm_param
      PAGERDUTY_ROUTING_KEY = var.pagerduty_routing_key
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

# ── CloudWatch alarms: Lambda errors ─────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.key}-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  alarm_description   = "Lambda ${each.key} error count >= ${var.lambda_error_threshold}"
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.key }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Phase = "5.3" })
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.key}-throttles"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Lambda ${each.key} throttles"
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.key }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Phase = "5.3" })
}

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

  tags = merge(var.tags, { Phase = "5.3" })
}

# ── CloudWatch alarms: API Gateway ────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Average"
  threshold           = var.api_5xx_threshold_pct / 100
  alarm_description   = "API Gateway 5xx error rate >= ${var.api_5xx_threshold_pct}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_id
    Stage   = var.api_gateway_stage
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Phase = "5.3" })
}

resource "aws_cloudwatch_metric_alarm" "api_latency_p99" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-api-latency-p99"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p99"
  threshold           = var.api_latency_p99_ms
  alarm_description   = "API Gateway P99 latency >= ${var.api_latency_p99_ms} ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_id
    Stage   = var.api_gateway_stage
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Phase = "5.3" })
}

# ── CloudWatch alarms: Aurora ─────────────────────────────────────────────────

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

  tags = merge(var.tags, { Phase = "5.3" })
}
