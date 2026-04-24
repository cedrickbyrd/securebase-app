locals {
  common_tags = merge(var.tags, {
    Phase     = "5.3"
    Component = "cost-optimization"
    ManagedBy = "terraform"
  })
}

data "aws_caller_identity" "current" {}

# ── Cost Anomaly Detection ────────────────────────────────────────────────────
resource "aws_ce_anomaly_monitor" "securebase" {
  name         = "securebase-${var.environment}-service-monitor"
  monitor_type = "DIMENSIONAL"

  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "securebase" {
  name      = "securebase-${var.environment}-anomaly-alerts"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.securebase.arn]

  subscriber {
    type    = "SNS"
    address = var.alert_sns_arn
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_PERCENTAGE"
      values        = [tostring(var.anomaly_threshold_percent)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}

# ── S3 Intelligent-Tiering ────────────────────────────────────────────────────
resource "aws_s3_bucket_intelligent_tiering_configuration" "app_buckets" {
  for_each = var.s3_bucket_names

  bucket = each.value
  name   = "securebase-intelligent-tiering"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

# ── DynamoDB autoscaling for high-traffic tables ──────────────────────────────
resource "aws_appautoscaling_target" "dynamodb_read" {
  for_each = var.dynamodb_provisioned_tables

  max_capacity       = each.value.max_read
  min_capacity       = each.value.min_read
  resource_id        = "table/${each.key}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_read" {
  for_each = var.dynamodb_provisioned_tables

  name               = "securebase-${each.key}-read-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_read[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_read[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_read[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_target" "dynamodb_write" {
  for_each = var.dynamodb_provisioned_tables

  max_capacity       = each.value.max_write
  min_capacity       = each.value.min_write
  resource_id        = "table/${each.key}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_write" {
  for_each = var.dynamodb_provisioned_tables

  name               = "securebase-${each.key}-write-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_write[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_write[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_write[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = 70.0
  }
}
