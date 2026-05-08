# ── ElastiCache Redis alarms ───────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cache_cpu" {
  count = var.elasticache_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-cache-cpu-high"
  alarm_description   = "ElastiCache CPU utilization >= 80%"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = { CacheClusterId = var.elasticache_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cache_evictions" {
  count = var.elasticache_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-cache-evictions"
  alarm_description   = "ElastiCache evictions exceeded threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = var.cache_eviction_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { CacheClusterId = var.elasticache_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cache_connections" {
  count = var.elasticache_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-cache-connections-high"
  alarm_description   = "ElastiCache current connections exceeded threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.cache_max_connections
  treat_missing_data  = "notBreaching"

  dimensions = { CacheClusterId = var.elasticache_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cache_memory_pct" {
  count = var.elasticache_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-cache-memory-pct-high"
  alarm_description   = "ElastiCache memory usage percentage >= 85%"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = { CacheClusterId = var.elasticache_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cache_replication_lag" {
  count = var.elasticache_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-cache-replication-lag"
  alarm_description   = "ElastiCache replication lag >= 5 seconds"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = { CacheClusterId = var.elasticache_cluster_id }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}
