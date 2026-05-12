terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  non_critical_function_keys = {
    for function_name in var.non_critical_functions :
    function_name => replace(function_name, "securebase-${var.environment}-", "")
  }
}

resource "aws_lambda_alias" "high_traffic" {
  for_each = var.high_traffic_functions

  name             = each.value.alias
  description      = "Phase 6 Track 5 alias for provisioned concurrency"
  function_name    = each.value.function_name
  function_version = each.value.function_version
}

resource "aws_lambda_provisioned_concurrency_config" "high_traffic" {
  for_each = var.high_traffic_functions

  function_name                     = each.value.function_name
  qualifier                         = aws_lambda_alias.high_traffic[each.key].name
  provisioned_concurrent_executions = each.value.provisioned_min
}

resource "aws_appautoscaling_target" "provisioned_concurrency" {
  for_each = var.high_traffic_functions

  max_capacity       = each.value.provisioned_max
  min_capacity       = each.value.provisioned_min
  resource_id        = "function:${each.value.function_name}:${aws_lambda_alias.high_traffic[each.key].name}"
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  service_namespace  = "lambda"
}

resource "aws_appautoscaling_policy" "provisioned_concurrency" {
  for_each = var.high_traffic_functions

  name               = "securebase-${var.environment}-${each.key}-pc-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.provisioned_concurrency[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.provisioned_concurrency[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.provisioned_concurrency[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = each.value.target_utilization
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "LambdaProvisionedConcurrencyUtilization"
    }
  }
}

resource "aws_appautoscaling_scheduled_action" "prewarm" {
  for_each = var.high_traffic_functions

  name               = "securebase-${var.environment}-${each.key}-prewarm-7am-utc"
  service_namespace  = "lambda"
  resource_id        = aws_appautoscaling_target.provisioned_concurrency[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.provisioned_concurrency[each.key].scalable_dimension
  schedule           = "cron(0 7 * * ? *)"
  timezone           = "UTC"

  scalable_target_action {
    min_capacity = each.value.provisioned_min
    max_capacity = each.value.provisioned_max
  }
}

resource "aws_cloudwatch_metric_alarm" "cold_start_init_duration" {
  for_each = var.high_traffic_functions

  alarm_name          = "securebase-${var.environment}-${each.key}-cold-start-initduration"
  alarm_description   = "Alert when InitDuration > 1000ms for ${each.value.function_name}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = "InitDuration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1000
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value.function_name
    Resource     = "${each.value.function_name}:${aws_lambda_alias.high_traffic[each.key].name}"
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "non_critical_concurrency_cap" {
  for_each = local.non_critical_function_keys

  alarm_name          = "securebase-${var.environment}-${each.value}-concurrency-over-50"
  alarm_description   = "Non-critical Lambda exceeded 50 concurrent executions (noisy-neighbor guardrail)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 50
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.key
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  tags          = var.tags
}
