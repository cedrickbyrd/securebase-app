locals {
  common_tags = merge(var.tags, {
    Phase = "5.3"
  })
}

# ── Aurora alarms ───────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "aurora_cpu_db" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-cpu-high"
  alarm_description   = "Aurora cluster ${var.aurora_cluster_id} CPU >= 80%"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-connections-high"
  alarm_description   = "Aurora database connections reached configured threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.aurora_max_connections
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_replica_lag" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-replica-lag"
  alarm_description   = "Aurora replica lag >= 30000ms (RPO risk)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "AuroraReplicaLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 30000
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_deadlocks" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-deadlocks"
  alarm_description   = "Aurora deadlocks detected"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Deadlocks"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(local.common_tags, { Severity = "high" })
}

resource "aws_cloudwatch_metric_alarm" "aurora_freeable_memory" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-freeable-memory-low"
  alarm_description   = "Aurora freeable memory <= 256MB"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Minimum"
  threshold           = 268435456 # 256MB in bytes
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_storage_pct" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-free-storage-low"
  alarm_description   = "Aurora free local storage <= 5GB"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeLocalStorage"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Minimum"
  threshold           = 5368709120 # 5GB in bytes
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# ── DynamoDB alarms ────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dynamodb_system_errors" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-system-errors"
  alarm_description   = "DynamoDB table ${each.value} system errors detected"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_user_errors" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-user-errors"
  alarm_description   = "DynamoDB table ${each.value} user errors are elevated"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttled_requests" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-throttled-requests"
  alarm_description   = "DynamoDB table ${each.value} throttled requests high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.dynamodb_throttle_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_latency_get" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-getitem-latency-p99"
  alarm_description   = "DynamoDB table ${each.value} GetItem latency P99 >= 50ms"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  extended_statistic  = "p99"
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = 300
  threshold           = 50
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = each.value
    Operation = "GetItem"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_latency_put" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-putitem-latency-p99"
  alarm_description   = "DynamoDB table ${each.value} PutItem latency P99 >= 50ms"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  extended_statistic  = "p99"
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = 300
  threshold           = 50
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = each.value
    Operation = "PutItem"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}
