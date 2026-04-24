data "aws_iam_role" "lambda_exec" {
  name = "securebase_lambda_exec_role"
}

# ── Health Check Aggregator (runs every 60s) ──────────────────────────────────
data "archive_file" "health_check_aggregator" {
  type        = "zip"
  source_file = "${path.module}/../../../../phase2-backend/functions/health_check_aggregator.py"
  output_path = "${path.module}/health_check_aggregator.zip"
}

resource "aws_lambda_function" "health_check_aggregator" {
  function_name    = "securebase-${var.environment}-health-check-aggregator"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "health_check_aggregator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.health_check_aggregator.output_path
  source_code_hash = data.archive_file.health_check_aggregator.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      PRIMARY_REGION   = var.primary_region
      SECONDARY_REGION = var.secondary_region
      AURORA_CLUSTER_ID = var.aurora_cluster_id
      API_GATEWAY_ID   = "9xyetu7zq3"
      ENVIRONMENT      = var.environment
    }
  }

  tags = local.dr_tags
}

resource "aws_cloudwatch_event_rule" "health_check_schedule" {
  name                = "securebase-${var.environment}-health-check"
  description         = "Run health check aggregator every 60 seconds"
  schedule_expression = "rate(1 minute)"
  tags                = local.dr_tags
}

resource "aws_cloudwatch_event_target" "health_check" {
  rule      = aws_cloudwatch_event_rule.health_check_schedule.name
  target_id = "HealthCheckAggregator"
  arn       = aws_lambda_function.health_check_aggregator.arn
}

resource "aws_lambda_permission" "health_check_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health_check_aggregator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.health_check_schedule.arn
}

# ── Failover Orchestrator (alarm-triggered) ───────────────────────────────────
data "archive_file" "failover_orchestrator" {
  type        = "zip"
  source_file = "${path.module}/../../../../phase2-backend/functions/failover_orchestrator.py"
  output_path = "${path.module}/failover_orchestrator.zip"
}

resource "aws_lambda_function" "failover_orchestrator" {
  function_name    = "securebase-${var.environment}-failover-orchestrator"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "failover_orchestrator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.failover_orchestrator.output_path
  source_code_hash = data.archive_file.failover_orchestrator.output_base64sha256
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      PRIMARY_REGION              = var.primary_region
      SECONDARY_REGION            = var.secondary_region
      AURORA_GLOBAL_CLUSTER_ID    = "securebase-${var.environment}-global"
      SECONDARY_AURORA_CLUSTER_ARN = try(aws_rds_cluster.secondary.arn, "")
      ALERT_SNS_ARN               = var.alert_sns_arn
      ENVIRONMENT                 = var.environment
    }
  }

  tags = local.dr_tags
}

# ── Failback Orchestrator (manual trigger via API) ────────────────────────────
data "archive_file" "failback_orchestrator" {
  type        = "zip"
  source_file = "${path.module}/../../../../phase2-backend/functions/failback_orchestrator.py"
  output_path = "${path.module}/failback_orchestrator.zip"
}

resource "aws_lambda_function" "failback_orchestrator" {
  function_name    = "securebase-${var.environment}-failback-orchestrator"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "failback_orchestrator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.failback_orchestrator.output_path
  source_code_hash = data.archive_file.failback_orchestrator.output_base64sha256
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      PRIMARY_REGION        = var.primary_region
      SECONDARY_REGION      = var.secondary_region
      PRIMARY_AURORA_CLUSTER_ARN   = "arn:aws:rds:${var.primary_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.aurora_cluster_id}"
      SECONDARY_AURORA_CLUSTER_ARN = try(aws_rds_cluster.secondary.arn, "")
      ALERT_SNS_ARN         = var.alert_sns_arn
      ENVIRONMENT           = var.environment
    }
  }

  tags = local.dr_tags
}

# ── CloudWatch alarms on RegionHealth custom metrics ─────────────────────────
resource "aws_cloudwatch_metric_alarm" "primary_region_unhealthy" {
  alarm_name          = "securebase-${var.environment}-primary-overall-unhealthy"
  alarm_description   = "Primary region overall health is 0 — consider failover"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ServiceHealth"
  namespace           = "SecureBase/RegionHealth"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    Region      = var.primary_region
    Service     = "overall"
    Environment = var.environment
  }

  alarm_actions = var.alert_sns_arn != "" ? [var.alert_sns_arn] : []

  tags = local.dr_tags
}
