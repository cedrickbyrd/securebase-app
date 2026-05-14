data "aws_iam_role" "lambda_exec" {
  name = "securebase_lambda_exec_role"
}

# ── Health Check Aggregator (runs every 60s) ──────────────────────────────────
data "archive_file" "health_check_aggregator" {
  type        = "zip"
  source_file = "${path.root}/../phase2-backend/functions/health_check_aggregator.py"
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
      PRIMARY_REGION      = var.primary_region
      SECONDARY_REGION    = var.secondary_region
      AURORA_CLUSTER_ID   = var.aurora_cluster_id
      API_GATEWAY_ID      = "9xyetu7zq3"
      SECONDARY_API_GW_ID = var.secondary_api_gateway_id
      ENVIRONMENT         = var.environment
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
  source_file = "${path.root}/../phase2-backend/functions/failover_orchestrator.py"
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
      PRIMARY_REGION               = var.primary_region
      SECONDARY_REGION             = var.secondary_region
      AURORA_GLOBAL_CLUSTER_ID     = "securebase-${var.environment}-global"
      SECONDARY_AURORA_CLUSTER_ARN = try(aws_rds_cluster.secondary[0].arn, "")
      ALERT_SNS_ARN                = var.alert_sns_arn
      ENVIRONMENT                  = var.environment
    }
  }

  tags = local.dr_tags
}

# ── Failback Orchestrator (manual trigger via API) ────────────────────────────
data "archive_file" "failback_orchestrator" {
  type        = "zip"
  source_file = "${path.root}/../phase2-backend/functions/failback_orchestrator.py"
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
      PRIMARY_REGION               = var.primary_region
      SECONDARY_REGION             = var.secondary_region
      PRIMARY_AURORA_CLUSTER_ARN   = "arn:aws:rds:${var.primary_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.aurora_cluster_id}"
      SECONDARY_AURORA_CLUSTER_ARN = try(aws_rds_cluster.secondary[0].arn, "")
      ALERT_SNS_ARN                = var.alert_sns_arn
      ENVIRONMENT                  = var.environment
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
  tags          = local.dr_tags
}

resource "aws_cloudwatch_event_rule" "primary_region_unhealthy_alarm" {
  name        = "securebase-${var.environment}-primary-region-unhealthy-alarm"
  description = "Invoke failover orchestrator when the primary region health alarm fires"

  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail-type = ["CloudWatch Alarm State Change"]
    detail = {
      alarmName = [aws_cloudwatch_metric_alarm.primary_region_unhealthy.alarm_name]
      state = {
        value = ["ALARM"]
      }
    }
  })

  tags = local.dr_tags
}

resource "aws_cloudwatch_event_target" "primary_region_unhealthy_failover" {
  rule      = aws_cloudwatch_event_rule.primary_region_unhealthy_alarm.name
  target_id = "failover-orchestrator"
  arn       = aws_lambda_function.failover_orchestrator.arn
}

resource "aws_lambda_permission" "failover_eventbridge" {
  statement_id  = "AllowPrimaryRegionAlarmInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.failover_orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.primary_region_unhealthy_alarm.arn
}

# ── DR Drill Lambda (monthly scheduled) ──────────────────────────────────────
# Source: src/lambdas/dr/dr_drill.py

data "archive_file" "dr_drill" {
  type        = "zip"
  source_file = "${path.root}/../../src/lambdas/dr/dr_drill.py"
  output_path = "${path.module}/dr_drill.zip"
}

resource "aws_lambda_function" "dr_drill" {
  function_name    = "securebase-${var.environment}-dr-drill"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "dr_drill.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.dr_drill.output_path
  source_code_hash = data.archive_file.dr_drill.output_base64sha256
  timeout          = 1020  # 17 min: 15 min RTO target + 2 min buffer for validation and S3 report upload
  memory_size      = 256

  environment {
    variables = {
      PRIMARY_REGION            = var.primary_region
      SECONDARY_REGION          = var.secondary_region
      AURORA_GLOBAL_CLUSTER_ID  = "securebase-${var.environment}-global"
      FAILOVER_LAMBDA_ARN       = aws_lambda_function.failover_orchestrator.arn
      DRILL_REPORT_BUCKET       = var.drill_report_bucket
      ALERT_SNS_ARN             = var.alert_sns_arn
      ENVIRONMENT               = var.environment
    }
  }

  tags = local.dr_tags
}

# ── EventBridge: monthly DR drill — first Sunday of the month at 02:00 UTC ───

resource "aws_cloudwatch_event_rule" "dr_drill_monthly" {
  name                = "securebase-${var.environment}-dr-drill-monthly"
  description         = "Monthly DR drill — first Sunday at 02:00 UTC (Phase 6 / Track 2, Sub-task 2.5)"
  schedule_expression = "cron(0 2 ? * 1#1 *)"

  tags = local.dr_tags
}

resource "aws_cloudwatch_event_target" "dr_drill_monthly" {
  rule      = aws_cloudwatch_event_rule.dr_drill_monthly.name
  target_id = "DrDrillMonthly"
  arn       = aws_lambda_function.dr_drill.arn
}

resource "aws_lambda_permission" "dr_drill_eventbridge" {
  statement_id  = "AllowMonthlyDrillInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dr_drill.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.dr_drill_monthly.arn
}

# ── Failover Validator Lambda ─────────────────────────────────────────────────
# Source: src/lambdas/dr/failover_validator.py
# Invoked by dr_drill.py post-failover; also available for manual validation.

data "archive_file" "failover_validator" {
  type        = "zip"
  source_file = "${path.root}/../../src/lambdas/dr/failover_validator.py"
  output_path = "${path.module}/failover_validator.zip"
}

resource "aws_lambda_function" "failover_validator" {
  function_name    = "securebase-${var.environment}-failover-validator"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "failover_validator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.failover_validator.output_path
  source_code_hash = data.archive_file.failover_validator.output_base64sha256
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      PRIMARY_REGION            = var.primary_region
      SECONDARY_REGION          = var.secondary_region
      AURORA_GLOBAL_CLUSTER_ID  = "securebase-${var.environment}-global"
      AURORA_CLUSTER_ID         = var.aurora_cluster_id
      DYNAMODB_TABLE_NAMES      = join(",", var.dynamodb_table_names)
      SECONDARY_HEALTH_URL      = var.secondary_health_url
      ALERT_SNS_ARN             = var.alert_sns_arn
      ENVIRONMENT               = var.environment
    }
  }

  tags = local.dr_tags
}
