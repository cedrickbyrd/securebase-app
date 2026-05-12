# ── Phase 6 / Track 3: CloudWatch Alarm Rules ─────────────────────────────────
# 40+ alarms covering infrastructure, security, cost anomaly, and compliance.
# Alarms are tagged with Severity=P1/P2/P3 matching the SNS topic routing.

# ── Infrastructure: Lambda ────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-error-rate"
  alarm_description   = "Lambda ${each.value} error rate > 1% — potential service impact"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "errors / MAX([errors, invocations]) * 100"
    label       = "Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = each.value }
    }
  }

  metric_query {
    id = "invocations"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = each.value }
    }
  }

  alarm_actions = [aws_sns_topic.p2_high.arn]
  ok_actions    = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "lambda_p95_duration" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-p95-duration"
  alarm_description   = "Lambda ${each.value} p95 duration > 3s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p95"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  threshold           = 3000
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-throttles"
  alarm_description   = "Lambda ${each.value} throttles > 0 in 5-min window"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "lambda_dlq_depth" {
  for_each = var.lambda_dlq_arns

  alarm_name          = "securebase-${var.environment}-${each.key}-dlq-depth"
  alarm_description   = "Lambda DLQ ${each.key} has messages — failed invocations need attention"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { QueueName = each.key }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

# ── Infrastructure: API Gateway ───────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "apigw_5xx_rate" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-apigw-5xx-rate"
  alarm_description   = "API Gateway 5xx error rate > 0.5%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "(e5xx / total) * 100"
    label       = "5xx Rate (%)"
    return_data = true
  }

  metric_query {
    id = "e5xx"
    metric {
      metric_name = "5XXError"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_id
        Stage   = var.api_gateway_stage
      }
    }
  }

  metric_query {
    id = "total"
    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions = {
        ApiName = var.api_gateway_id
        Stage   = var.api_gateway_stage
      }
    }
  }

  alarm_actions = [aws_sns_topic.p1_critical.arn]
  ok_actions    = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "apigw_p99_latency" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-apigw-p99-latency"
  alarm_description   = "API Gateway p99 latency > 2s — SLA breach risk"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p99"
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  threshold           = 2000
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_id
    Stage   = var.api_gateway_stage
  }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "apigw_4xx_spike" {
  count = var.api_gateway_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-apigw-4xx-spike"
  alarm_description   = "API Gateway 4xx errors elevated — possible auth attack or client issue"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = var.apigw_4xx_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_id
    Stage   = var.api_gateway_stage
  }

  alarm_actions = [aws_sns_topic.p3_medium.arn]

  tags = merge(local.common_tags, { Severity = "P3", AlarmCategory = "infrastructure" })
}

# ── Infrastructure: Aurora ────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "aurora_cpu_high" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-cpu-high"
  alarm_description   = "Aurora CPU > 80% (5-min avg)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "aurora_connections_high" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-connections-high"
  alarm_description   = "Aurora connections > 80% of max_connections"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.aurora_max_connections_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "aurora_replication_lag" {
  count = var.aurora_cluster_id != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-aurora-replication-lag"
  alarm_description   = "Aurora Global DB replication lag > 1s — RPO at risk"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "AuroraGlobalDBReplicationLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.p1_critical.arn]
  ok_actions    = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "infrastructure" })
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
  threshold           = 268435456
  treat_missing_data  = "notBreaching"

  dimensions = { DBClusterIdentifier = var.aurora_cluster_id }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

# ── Infrastructure: DynamoDB ──────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dynamodb_consumed_read" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-consumed-read-high"
  alarm_description   = "DynamoDB ${each.value} consumed read capacity > 80% of provisioned"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedReadCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.dynamodb_read_capacity_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.p3_medium.arn]

  tags = merge(local.common_tags, { Severity = "P3", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_consumed_write" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-consumed-write-high"
  alarm_description   = "DynamoDB ${each.value} consumed write capacity > 80% of provisioned"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedWriteCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.dynamodb_write_capacity_threshold
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.p3_medium.arn]

  tags = merge(local.common_tags, { Severity = "P3", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_system_errors" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-system-errors"
  alarm_description   = "DynamoDB ${each.value} system errors detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "infrastructure" })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  for_each = toset(var.dynamodb_table_names)

  alarm_name          = "securebase-${var.environment}-${each.value}-dynamodb-throttles"
  alarm_description   = "DynamoDB ${each.value} throttled requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.p3_medium.arn]

  tags = merge(local.common_tags, { Severity = "P3", AlarmCategory = "infrastructure" })
}

# ── Security Alarms ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "guardduty_high_findings" {
  count = var.enable_security_alarms ? 1 : 0

  alarm_name          = "securebase-${var.environment}-guardduty-high-critical-findings"
  alarm_description   = "GuardDuty HIGH or CRITICAL finding detected — immediate investigation required"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FindingCount"
  namespace           = "AWS/GuardDuty"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p1_critical.arn]
  ok_actions    = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "security" })
}

resource "aws_cloudwatch_metric_alarm" "failed_auth_attempts" {
  count = var.enable_security_alarms ? 1 : 0

  alarm_name          = "securebase-${var.environment}-failed-auth-attempts"
  alarm_description   = "Failed login attempts > 10 in 5 minutes — possible brute-force attack"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedAuthentication"
  namespace           = "SecureBase/Auth"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "security" })
}

resource "aws_cloudwatch_log_metric_filter" "root_login" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-root-account-login"
  log_group_name = var.cloudtrail_log_group
  pattern        = "{ ($.userIdentity.type = \"Root\") && ($.eventType = \"AwsConsoleSignIn\") }"

  metric_transformation {
    name      = "RootAccountLoginCount"
    namespace = "SecureBase/Security"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "root_login" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-root-account-login"
  alarm_description   = "Root account login detected — CIS 1.7 violation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RootAccountLoginCount"
  namespace           = "SecureBase/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "security" })

  depends_on = [aws_cloudwatch_log_metric_filter.root_login]
}

resource "aws_cloudwatch_log_metric_filter" "iam_policy_change" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-iam-policy-change"
  log_group_name = var.cloudtrail_log_group
  pattern        = "{ ($.eventSource = \"iam.amazonaws.com\") && (($.eventName = \"DeleteGroupPolicy\") || ($.eventName = \"DeleteRolePolicy\") || ($.eventName = \"DeleteUserPolicy\") || ($.eventName = \"PutGroupPolicy\") || ($.eventName = \"PutRolePolicy\") || ($.eventName = \"PutUserPolicy\") || ($.eventName = \"CreatePolicy\") || ($.eventName = \"DeletePolicy\") || ($.eventName = \"CreatePolicyVersion\") || ($.eventName = \"DeletePolicyVersion\") || ($.eventName = \"SetDefaultPolicyVersion\") || ($.eventName = \"AttachRolePolicy\") || ($.eventName = \"DetachRolePolicy\") || ($.eventName = \"AttachUserPolicy\") || ($.eventName = \"DetachUserPolicy\") || ($.eventName = \"AttachGroupPolicy\") || ($.eventName = \"DetachGroupPolicy\")) }"

  metric_transformation {
    name      = "IAMPolicyChangeCount"
    namespace = "SecureBase/Security"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "iam_policy_change" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-iam-policy-change"
  alarm_description   = "IAM policy change detected via CloudTrail"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "IAMPolicyChangeCount"
  namespace           = "SecureBase/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "security" })

  depends_on = [aws_cloudwatch_log_metric_filter.iam_policy_change]
}

resource "aws_cloudwatch_log_metric_filter" "security_group_change" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-security-group-change"
  log_group_name = var.cloudtrail_log_group
  pattern        = "{ ($.eventName = \"AuthorizeSecurityGroupIngress\") || ($.eventName = \"AuthorizeSecurityGroupEgress\") || ($.eventName = \"RevokeSecurityGroupIngress\") || ($.eventName = \"RevokeSecurityGroupEgress\") || ($.eventName = \"CreateSecurityGroup\") || ($.eventName = \"DeleteSecurityGroup\") }"

  metric_transformation {
    name      = "SecurityGroupChangeCount"
    namespace = "SecureBase/Security"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "security_group_change" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-security-group-change"
  alarm_description   = "Security group modification detected via CloudTrail"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SecurityGroupChangeCount"
  namespace           = "SecureBase/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "security" })

  depends_on = [aws_cloudwatch_log_metric_filter.security_group_change]
}

resource "aws_cloudwatch_log_metric_filter" "waf_blocked_spike" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-waf-blocked-spike"
  log_group_name = var.cloudtrail_log_group
  pattern        = "[timestamp, account_id, source_ip, ..., action = \"BLOCK\"]"

  metric_transformation {
    name      = "WAFBlockedRequests"
    namespace = "SecureBase/Security"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "waf_blocked_spike" {
  count = var.cloudtrail_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-waf-blocked-requests-spike"
  alarm_description   = "WAF blocked requests anomaly — possible DDoS or attack campaign"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"
    metric {
      metric_name = "WAFBlockedRequests"
      namespace   = "SecureBase/Security"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 3)"
    label       = "WAFBlockedRequestsBand"
    return_data = true
  }

  alarm_actions = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "security" })

  depends_on = [aws_cloudwatch_log_metric_filter.waf_blocked_spike]
}

# ── Cost Anomaly Alarms ───────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "daily_spend_anomaly" {
  alarm_name          = "securebase-${var.environment}-daily-spend-anomaly"
  alarm_description   = "Daily AWS spend > 120% of 7-day average — investigate cost spike"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 1
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"
    metric {
      metric_name = "EstimatedCharges"
      namespace   = "AWS/Billing"
      period      = 86400
      stat        = "Maximum"
      dimensions  = { Currency = "USD" }
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "DailySpendAnomalyBand"
    return_data = true
  }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "cost" })
}

resource "aws_cloudwatch_metric_alarm" "lambda_invocations_spike" {
  alarm_name          = "securebase-${var.environment}-lambda-invocations-spike"
  alarm_description   = "Lambda invocations > 200% of 7-day average — runaway function or abuse"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 2
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 4)"
    label       = "InvocationsAnomalyBand"
    return_data = true
  }

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "cost" })
}

resource "aws_ce_anomaly_monitor" "cost_anomaly" {
  name              = "securebase-${var.environment}-cost-anomaly-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = local.common_tags
}

resource "aws_ce_anomaly_subscription" "cost_anomaly_alert" {
  name      = "securebase-${var.environment}-cost-anomaly-subscription"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.cost_anomaly.arn]

  subscriber {
    address = aws_sns_topic.p2_high.arn
    type    = "SNS"
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_PERCENTAGE"
      values        = ["20"]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  tags = local.common_tags
}

# ── Compliance Alarms ─────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_metric_filter" "compliance_drift" {
  count = var.compliance_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-compliance-drift"
  log_group_name = var.compliance_log_group
  pattern        = "[timestamp, level = \"ERROR\", ..., event = \"COMPLIANCE_DRIFT_DETECTED\", ...]"

  metric_transformation {
    name      = "ComplianceDriftCount"
    namespace = "SecureBase/Compliance"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "compliance_drift" {
  count = var.compliance_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-compliance-drift-detected"
  alarm_description   = "Compliance control drift detected — immediate review required"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ComplianceDriftCount"
  namespace           = "SecureBase/Compliance"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "compliance" })

  depends_on = [aws_cloudwatch_log_metric_filter.compliance_drift]
}

resource "aws_cloudwatch_log_metric_filter" "audit_log_integrity_failure" {
  count = var.compliance_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-audit-log-integrity-failure"
  log_group_name = var.compliance_log_group
  pattern        = "[timestamp, level = \"ERROR\", ..., event = \"AUDIT_INTEGRITY_FAILURE\", ...]"

  metric_transformation {
    name      = "AuditIntegrityFailureCount"
    namespace = "SecureBase/Compliance"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "audit_log_integrity_failure" {
  count = var.compliance_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-audit-log-integrity-failure"
  alarm_description   = "Audit log integrity check failed — possible tampering or data loss"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AuditIntegrityFailureCount"
  namespace           = "SecureBase/Compliance"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "compliance" })

  depends_on = [aws_cloudwatch_log_metric_filter.audit_log_integrity_failure]
}

resource "aws_cloudwatch_log_metric_filter" "evidence_collection_failure" {
  count = var.compliance_log_group != "" ? 1 : 0

  name           = "securebase-${var.environment}-evidence-collection-failure"
  log_group_name = var.compliance_log_group
  pattern        = "[timestamp, level = \"ERROR\", ..., event = \"EVIDENCE_COLLECTION_FAILED\", ...]"

  metric_transformation {
    name      = "EvidenceCollectionFailureCount"
    namespace = "SecureBase/Compliance"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "evidence_collection_failure" {
  count = var.compliance_log_group != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-evidence-collection-failure"
  alarm_description   = "Evidence collection Lambda failed — audit packages may be incomplete"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EvidenceCollectionFailureCount"
  namespace           = "SecureBase/Compliance"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.p2_high.arn]

  tags = merge(local.common_tags, { Severity = "P2", AlarmCategory = "compliance" })

  depends_on = [aws_cloudwatch_log_metric_filter.evidence_collection_failure]
}

# ── Composite Alarms: reduce noise ────────────────────────────────────────────

resource "aws_cloudwatch_composite_alarm" "full_service_outage" {
  alarm_name        = "securebase-${var.environment}-FULL-SERVICE-OUTAGE"
  alarm_description = "API Gateway 5xx + Lambda errors — full service outage"

  alarm_rule = join(" AND ", compact([
    var.api_gateway_id != "" ? "ALARM(\"${aws_cloudwatch_metric_alarm.apigw_5xx_rate[0].alarm_name}\")" : "",
    length(var.lambda_function_names) > 0 ? "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_error_rate[var.lambda_function_names[0]].alarm_name}\")" : "",
  ]))

  alarm_actions = [aws_sns_topic.p1_critical.arn]
  ok_actions    = [aws_sns_topic.p1_critical.arn]

  tags = merge(local.common_tags, { Severity = "P1", AlarmCategory = "composite" })

  lifecycle {
    ignore_changes = [alarm_rule]
  }
}
