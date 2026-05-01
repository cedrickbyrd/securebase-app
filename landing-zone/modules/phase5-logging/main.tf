# =============================================================================
# Phase 5.3 – Component 4: Logging & Distributed Tracing
# =============================================================================
# Delivers:
# - Per-service CloudWatch log groups with environment-appropriate retention
# - AWS X-Ray tracing across API Gateway → Lambda → Aurora
# - 1% trace sampling for cost efficiency
# - 20+ CloudWatch Logs Insights saved queries
# - X-Ray groups for service isolation

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# =============================================================================
# CloudWatch Log Groups (per service)
# =============================================================================

locals {
  # dev: 7 days, staging: 90 days, prod: 365 days
  retention_days = var.environment == "prod" ? 365 : (var.environment == "staging" ? 90 : 7)

  services = [
    "auth-v2",
    "metrics-aggregation",
    "tenant-metrics",
    "billing-worker",
    "report-engine",
    "support-tickets",
    "webhook-manager",
    "cost-forecasting",
    "notification-worker",
    "audit-logging",
    "api-gateway",
    "failover-orchestrator",
    "health-check-aggregator",
    "failback-orchestrator",
  ]
}

resource "aws_cloudwatch_log_group" "service_logs" {
  for_each = toset(local.services)

  name              = "/aws/securebase/${var.environment}/${each.value}"
  retention_in_days = local.retention_days

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-${each.value}-logs"
    Environment = var.environment
    Phase       = "5.3"
    Service     = each.value
  })
}

# API Gateway access logs
resource "aws_cloudwatch_log_group" "api_gateway_access" {
  name              = "/aws/securebase/${var.environment}/api-gateway/access-logs"
  retention_in_days = local.retention_days

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-api-gateway-access"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "access-logs"
  })
}

# Aurora slow query logs
resource "aws_cloudwatch_log_group" "aurora_slow_query" {
  name              = "/aws/securebase/${var.environment}/aurora/slowquery"
  retention_in_days = local.retention_days

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-slowquery"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "database"
  })
}

# Aurora PostgreSQL error logs
resource "aws_cloudwatch_log_group" "aurora_error" {
  name              = "/aws/securebase/${var.environment}/aurora/error"
  retention_in_days = local.retention_days

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-aurora-error"
    Environment = var.environment
    Phase       = "5.3"
    Type        = "database"
  })
}

# =============================================================================
# X-Ray Tracing — Sampling Rule (1% for cost optimization)
# =============================================================================

resource "aws_xray_sampling_rule" "securebase" {
  rule_name      = "securebase-${var.environment}-default"
  priority       = 1000
  reservoir_size = 5     # Allow up to 5 traces/second burst
  fixed_rate     = 0.01  # 1% sampling rate for cost optimization
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "securebase-${var.environment}-*"
  resource_arn   = "*"
  version        = 1

  attributes = {}

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-sampling"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# Higher sampling for critical paths (auth, billing)
resource "aws_xray_sampling_rule" "critical_path" {
  rule_name      = "securebase-${var.environment}-critical"
  priority       = 500
  reservoir_size = 20
  fixed_rate     = 0.05  # 5% for critical services
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "securebase-${var.environment}-auth*"
  resource_arn   = "*"
  version        = 1

  attributes = {}

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-critical-sampling"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# =============================================================================
# X-Ray Groups (service isolation and filtering)
# =============================================================================

resource "aws_xray_group" "api_gateway" {
  group_name        = "securebase-${var.environment}-api-gateway"
  filter_expression = "service(\"securebase-${var.environment}-api-gateway\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-xray-api"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_xray_group" "auth" {
  group_name        = "securebase-${var.environment}-auth"
  filter_expression = "service(\"securebase-${var.environment}-auth-v2\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-xray-auth"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_xray_group" "database" {
  group_name        = "securebase-${var.environment}-database"
  filter_expression = "annotation.db_call = \"true\""

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = false
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-xray-database"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_xray_group" "errors" {
  group_name        = "securebase-${var.environment}-errors"
  filter_expression = "fault = true OR error = true"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-xray-errors"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# =============================================================================
# CloudWatch Logs Insights Saved Queries (20+)
# =============================================================================

resource "aws_cloudwatch_query_definition" "lambda_errors" {
  name = "SecureBase/${var.environment}/Lambda/Errors"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message, @requestId
    | filter @message like /(?i)(error|exception|traceback|failed)/
    | sort @timestamp desc
    | limit 100
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_cold_starts" {
  name = "SecureBase/${var.environment}/Lambda/ColdStarts"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @initDuration, @duration, @billedDuration
    | filter @type = "REPORT" and ispresent(@initDuration)
    | stats count() as cold_starts, avg(@initDuration) as avg_init_ms, max(@initDuration) as max_init_ms by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_duration_p95" {
  name = "SecureBase/${var.environment}/Lambda/DurationP95"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed, @logStream
    | filter @type = "REPORT"
    | stats pct(@duration, 50) as p50_ms, pct(@duration, 95) as p95_ms, pct(@duration, 99) as p99_ms by @logStream
    | sort p95_ms desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "auth_failures" {
  name = "SecureBase/${var.environment}/Auth/Failures"

  log_group_names = ["/aws/securebase/${var.environment}/auth-v2"]

  query_string = <<-EOQ
    fields @timestamp, @message, @requestId
    | filter @message like /(?i)(unauthorized|invalid.*key|auth.*fail|forbidden|403)/
    | stats count() as failures by bin(5m)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "api_5xx_errors" {
  name = "SecureBase/${var.environment}/API/5xxErrors"

  log_group_names = ["/aws/securebase/${var.environment}/api-gateway/access-logs"]

  query_string = <<-EOQ
    fields @timestamp, httpMethod, resourcePath, status, responseLength, @requestId
    | filter status >= 500
    | stats count() as error_count by resourcePath, status, bin(5m)
    | sort error_count desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "api_latency" {
  name = "SecureBase/${var.environment}/API/LatencyBreakdown"

  log_group_names = ["/aws/securebase/${var.environment}/api-gateway/access-logs"]

  query_string = <<-EOQ
    fields @timestamp, httpMethod, resourcePath, responseLatency
    | filter ispresent(responseLatency)
    | stats pct(responseLatency, 50) as p50_ms, pct(responseLatency, 95) as p95_ms, pct(responseLatency, 99) as p99_ms, count() as req_count by resourcePath
    | sort p95_ms desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "billing_errors" {
  name = "SecureBase/${var.environment}/Billing/Errors"

  log_group_names = ["/aws/securebase/${var.environment}/billing-worker"]

  query_string = <<-EOQ
    fields @timestamp, @message, @requestId
    | filter @message like /(?i)(error|fail|exception)/
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "tenant_metrics_slow" {
  name = "SecureBase/${var.environment}/TenantMetrics/SlowRequests"

  log_group_names = ["/aws/securebase/${var.environment}/tenant-metrics"]

  query_string = <<-EOQ
    fields @timestamp, @duration, @requestId, @message
    | filter @type = "REPORT" and @duration > 1000
    | sort @duration desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "aurora_slow_queries" {
  name = "SecureBase/${var.environment}/Aurora/SlowQueries"

  log_group_names = ["/aws/securebase/${var.environment}/aurora/slowquery"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /Query_time/
    | parse @message "Query_time: * Lock_time:" as query_time
    | filter query_time > 1
    | sort query_time desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "memory_utilization" {
  name = "SecureBase/${var.environment}/Lambda/MemoryUtilization"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @maxMemoryUsed, @memorySize
    | filter @type = "REPORT"
    | stats max(@maxMemoryUsed) as max_memory_mb, avg(@maxMemoryUsed) as avg_memory_mb, @memorySize as allocated_mb by @logStream
    | eval utilization_pct = (avg_memory_mb / allocated_mb) * 100
    | sort utilization_pct desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "failover_events" {
  name = "SecureBase/${var.environment}/DR/FailoverEvents"

  log_group_names = [
    "/aws/securebase/${var.environment}/failover-orchestrator",
    "/aws/securebase/${var.environment}/health-check-aggregator",
    "/aws/securebase/${var.environment}/failback-orchestrator",
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message, @requestId
    | filter @message like /(?i)(failover|failback|health.*check|primary|secondary|replica)/
    | sort @timestamp desc
    | limit 200
  EOQ
}

resource "aws_cloudwatch_query_definition" "security_events" {
  name = "SecureBase/${var.environment}/Security/Events"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /(?i)(security|intrusion|bruteforce|rate.limit|blocked|suspicious)/
    | sort @timestamp desc
    | limit 100
  EOQ
}

resource "aws_cloudwatch_query_definition" "request_volume" {
  name = "SecureBase/${var.environment}/API/RequestVolume"

  log_group_names = ["/aws/securebase/${var.environment}/api-gateway/access-logs"]

  query_string = <<-EOQ
    fields @timestamp, httpMethod, resourcePath, status
    | stats count() as request_count by resourcePath, httpMethod, bin(1h)
    | sort request_count desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "webhook_deliveries" {
  name = "SecureBase/${var.environment}/Webhooks/Deliveries"

  log_group_names = ["/aws/securebase/${var.environment}/webhook-manager"]

  query_string = <<-EOQ
    fields @timestamp, @message, @requestId
    | filter @message like /(?i)(delivered|failed|retry|webhook)/
    | stats count() as deliveries by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "notification_failures" {
  name = "SecureBase/${var.environment}/Notifications/Failures"

  log_group_names = ["/aws/securebase/${var.environment}/notification-worker"]

  query_string = <<-EOQ
    fields @timestamp, @message, @requestId
    | filter @message like /(?i)(error|fail|undeliverable)/
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "report_generation_time" {
  name = "SecureBase/${var.environment}/Reports/GenerationTime"

  log_group_names = ["/aws/securebase/${var.environment}/report-engine"]

  query_string = <<-EOQ
    fields @timestamp, @duration, @billedDuration, @requestId
    | filter @type = "REPORT"
    | stats avg(@duration) as avg_ms, max(@duration) as max_ms, pct(@duration, 95) as p95_ms by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "throttling_events" {
  name = "SecureBase/${var.environment}/Lambda/Throttling"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /(?i)(throttl|rate.exceed|too.many.request|429)/
    | stats count() as throttle_count by @logStream, bin(5m)
    | sort throttle_count desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "compliance_violations" {
  name = "SecureBase/${var.environment}/Compliance/Violations"

  log_group_names = ["/aws/securebase/${var.environment}/audit-logging"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /(?i)(violation|non.compliant|drift|failed.control)/
    | stats count() as violations by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "cost_anomalies" {
  name = "SecureBase/${var.environment}/Cost/Anomalies"

  log_group_names = ["/aws/securebase/${var.environment}/cost-forecasting"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /(?i)(anomaly|spike|unexpected.cost|budget.exceeded)/
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "all_errors_last_hour" {
  name = "SecureBase/${var.environment}/Ops/AllErrorsLastHour"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message, @requestId
    | filter @message like /(?i)(error|exception|traceback|critical|fatal)/
    | filter @timestamp > ago(1h)
    | stats count() as error_count by @logStream
    | sort error_count desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "p99_by_service" {
  name = "SecureBase/${var.environment}/Ops/P99ByService"

  log_group_names = [
    for svc in local.services : "/aws/securebase/${var.environment}/${svc}"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @duration
    | filter @type = "REPORT"
    | stats pct(@duration, 99) as p99_ms, count() as invocations by @logStream
    | sort p99_ms desc
  EOQ
}
