terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    Phase       = "6"
    Track       = "4"
  })

  lambda_names = toset(var.lambda_function_names)
  role_names   = toset(var.lambda_execution_role_names)
}

resource "aws_iam_role_policy_attachment" "lambda_insights" {
  for_each = local.role_names

  role       = each.key
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy"
}

resource "aws_xray_group" "tenant_segments" {
  for_each = var.xray_tenant_filters

  group_name        = "securebase-${var.environment}-${each.key}-traces"
  filter_expression = each.value

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.environment == "prod"
  }

  tags = merge(local.common_tags, {
    Service = each.key
  })
}

resource "aws_cloudwatch_contributor_insight_rule" "tenant_error_contributors" {
  count = var.api_gateway_log_group_name != null ? 1 : 0

  rule_name = "securebase-${var.environment}-tenant-error-contributors"

  rule_definition = jsonencode({
    Schema = {
      Name    = "CloudWatchLogRule"
      Version = 1
    }
    LogGroupNames = [var.api_gateway_log_group_name]
    LogFormat     = "JSON"
    Contribution = {
      Keys = ["$.tenantId"]
      Filters = [
        {
          Match = "$.status"
          In    = ["400", "401", "403", "404", "429", "500", "502", "503", "504"]
        }
      ]
    }
    AggregateOn = "Count"
  })
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p99_anomaly" {
  for_each = local.lambda_names

  alarm_name          = "securebase-${var.environment}-${each.key}-duration-p99-anomaly"
  alarm_description   = "Anomaly detection for Lambda p99 duration on ${each.key}"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"

    metric {
      metric_name = "Duration"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "p99"
      dimensions = {
        FunctionName = each.key
      }
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "Duration p99 (expected)"
    return_data = true
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, {
    Metric = "lambda-duration-p99"
  })
}

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate_anomaly" {
  for_each = local.lambda_names

  alarm_name          = "securebase-${var.environment}-${each.key}-error-rate-anomaly"
  alarm_description   = "Anomaly detection for Lambda error rate on ${each.key}"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m_errors"

    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.key
      }
    }
  }

  metric_query {
    id = "m_invocations"

    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.key
      }
    }
  }

  metric_query {
    id          = "m_rate"
    expression  = "IF(m_invocations>0,(m_errors/m_invocations)*100,0)"
    label       = "Lambda error rate (%)"
    return_data = false
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m_rate, 2)"
    label       = "Lambda error-rate expected band"
    return_data = true
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, {
    Metric = "lambda-error-rate"
  })
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx_rate_anomaly" {
  alarm_name          = "securebase-${var.environment}-api-4xx-rate-anomaly"
  alarm_description   = "Anomaly detection for API Gateway 4xx error rate"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m_4xx"

    metric {
      metric_name = "4XXError"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
    }
  }

  metric_query {
    id = "m_count"

    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
    }
  }

  metric_query {
    id          = "m_rate"
    expression  = "IF(m_count>0,(m_4xx/m_count)*100,0)"
    label       = "API Gateway 4xx rate (%)"
    return_data = false
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m_rate, 2)"
    label       = "API Gateway 4xx expected band"
    return_data = true
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, {
    Metric = "api-4xx-rate"
  })
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_rate_anomaly" {
  alarm_name          = "securebase-${var.environment}-api-5xx-rate-anomaly"
  alarm_description   = "Anomaly detection for API Gateway 5xx error rate"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m_5xx"

    metric {
      metric_name = "5XXError"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
    }
  }

  metric_query {
    id = "m_count"

    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
    }
  }

  metric_query {
    id          = "m_rate"
    expression  = "IF(m_count>0,(m_5xx/m_count)*100,0)"
    label       = "API Gateway 5xx rate (%)"
    return_data = false
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m_rate, 2)"
    label       = "API Gateway 5xx expected band"
    return_data = true
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = merge(local.common_tags, {
    Metric = "api-5xx-rate"
  })
}
