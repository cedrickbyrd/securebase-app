locals {
  lambda_log_groups = [for fn in var.lambda_function_names : "/aws/lambda/${fn}"]
  all_log_groups    = join(",", [for g in local.lambda_log_groups : "\"${g}\""])
}

# ── CloudWatch Logs Insights saved queries ───────────────────────────────────

resource "aws_cloudwatch_query_definition" "lambda_errors" {
  name = "SecureBase/${var.environment}/Lambda/Errors"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /ERROR|Exception|error/
    | sort @timestamp desc
    | limit 100
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_cold_starts" {
  name = "SecureBase/${var.environment}/Lambda/ColdStarts"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    filter @type = "REPORT"
    | fields @timestamp, @logStream,
        @initDuration as initDuration,
        @duration as duration,
        @billedDuration as billedDuration,
        @memorySize as memorySize,
        @maxMemoryUsed as maxMemoryUsed
    | filter ispresent(initDuration)
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_p99_latency" {
  name = "SecureBase/${var.environment}/Lambda/P99Latency"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    filter @type = "REPORT"
    | fields @logStream, @duration
    | stats
        count() as invocations,
        avg(@duration) as avgMs,
        pct(@duration, 50) as p50Ms,
        pct(@duration, 95) as p95Ms,
        pct(@duration, 99) as p99Ms,
        max(@duration) as maxMs
      by @logStream
    | sort p99Ms desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_throttles" {
  name = "SecureBase/${var.environment}/Lambda/Throttles"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /Task timed out|throttl/i
    | stats count() as throttleCount by @logStream
    | sort throttleCount desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "lambda_memory" {
  name = "SecureBase/${var.environment}/Lambda/MemoryUtilization"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    filter @type = "REPORT"
    | fields @logStream,
        @memorySize / 1024 / 1024 as memoryLimitMB,
        @maxMemoryUsed / 1024 / 1024 as memoryUsedMB,
        (@maxMemoryUsed / @memorySize * 100) as utilizationPct
    | stats avg(utilizationPct) as avgUtilPct, max(memoryUsedMB) as peakMB
      by @logStream
    | sort avgUtilPct desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "auth_failures" {
  name = "SecureBase/${var.environment}/Security/AuthFailures"
  log_group_names = ["/aws/lambda/securebase-${var.environment == "prod" ? "production-" : ""}auth-v2"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /Invalid credentials|Unauthorized|401/
    | stats count() as failureCount by bin(5m)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "audit_events" {
  name = "SecureBase/${var.environment}/Compliance/AuditEvents"
  log_group_names = ["/securebase/${var.environment}/audit"]

  query_string = <<-EOQ
    fields @timestamp, event_type, action, actor_email, customer_id, status
    | sort @timestamp desc
    | limit 200
  EOQ
}

resource "aws_cloudwatch_query_definition" "audit_by_customer" {
  name = "SecureBase/${var.environment}/Compliance/AuditByCustomer"
  log_group_names = ["/securebase/${var.environment}/audit"]

  query_string = <<-EOQ
    fields @timestamp, event_type, action, actor_email, status
    | stats count() as eventCount by customer_id, event_type
    | sort eventCount desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "failed_onboarding" {
  name = "SecureBase/${var.environment}/Onboarding/Failures"
  log_group_names = [
    "/aws/lambda/securebase-account-provisioner",
    "/aws/lambda/securebase-onboarding-orchestrator"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /failed|ERROR|Exception/i
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "api_5xx" {
  name = "SecureBase/${var.environment}/API/5xxErrors"
  log_group_names = ["/aws/apigateway/securebase-${var.environment}"]

  query_string = <<-EOQ
    fields @timestamp, status, httpMethod, resourcePath, responseLatency, userAgent
    | filter status >= 500
    | stats count() as errorCount by resourcePath, status
    | sort errorCount desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "api_latency" {
  name = "SecureBase/${var.environment}/API/LatencyByEndpoint"
  log_group_names = ["/aws/apigateway/securebase-${var.environment}"]

  query_string = <<-EOQ
    fields @timestamp, httpMethod, resourcePath, responseLatency
    | stats
        avg(responseLatency) as avgMs,
        pct(responseLatency, 95) as p95Ms,
        pct(responseLatency, 99) as p99Ms,
        count() as requests
      by resourcePath, httpMethod
    | sort p99Ms desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "signup_funnel" {
  name = "SecureBase/${var.environment}/Business/SignupFunnel"
  log_group_names = [
    "/aws/lambda/securebase-signup-handler",
    "/aws/lambda/securebase-verify-email",
    "/aws/lambda/securebase-account-provisioner"
  ]

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /Signup:|Email verified|Provisioning/
    | sort @timestamp desc
    | limit 100
  EOQ
}

resource "aws_cloudwatch_query_definition" "stripe_errors" {
  name = "SecureBase/${var.environment}/Business/StripeErrors"
  log_group_names = ["/aws/lambda/securebase-stripe-webhook"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /error|failed|webhook/i
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "hipaa_phi_access" {
  name = "SecureBase/${var.environment}/HIPAA/PHIAccessLog"
  log_group_names = ["/securebase/${var.environment}/audit"]

  query_string = <<-EOQ
    fields @timestamp, actor_email, customer_id, action, resource_type
    | filter event_type = "phi_access" or event_type = "data_access"
    | sort @timestamp desc
    | limit 500
  EOQ
}

resource "aws_cloudwatch_query_definition" "cost_anomaly_lambda" {
  name = "SecureBase/${var.environment}/Cost/LambdaInvocationVolume"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    filter @type = "REPORT"
    | stats count() as invocations, sum(@billedDuration) / 1000 as billedSeconds
      by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "mfa_events" {
  name = "SecureBase/${var.environment}/Security/MFAEvents"
  log_group_names = ["/aws/lambda/securebase-auth-v2"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /mfa|totp|MFA/i
    | sort @timestamp desc
    | limit 100
  EOQ
}

resource "aws_cloudwatch_query_definition" "db_errors" {
  name = "SecureBase/${var.environment}/Database/Errors"
  log_group_names = local.lambda_log_groups

  query_string = <<-EOQ
    fields @timestamp, @logStream, @message
    | filter @message like /DatabaseError|pg8000|psycopg|connection.*failed|Aurora/i
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "compliance_drift" {
  name = "SecureBase/${var.environment}/Compliance/DriftDetection"
  log_group_names = ["/securebase/${var.environment}/audit"]

  query_string = <<-EOQ
    fields @timestamp, customer_id, event_type, action, status
    | filter event_type like /compliance/
    | stats count() as events, count(status = "failed") as failures
      by customer_id, bin(24h)
    | sort failures desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "onboarding_duration" {
  name = "SecureBase/${var.environment}/Onboarding/ProvisioningDuration"
  log_group_names = ["/aws/lambda/securebase-account-provisioner"]

  query_string = <<-EOQ
    fields @timestamp, @duration, @message
    | filter @message like /completed|Provisioning/
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "api_key_usage" {
  name = "SecureBase/${var.environment}/Security/APIKeyUsage"
  log_group_names = ["/aws/lambda/securebase-auth-v2"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /api_key_authenticated|API key validated/
    | stats count() as authCount by bin(1h)
    | sort @timestamp desc
  EOQ
}

resource "aws_cloudwatch_query_definition" "webhook_failures" {
  name = "SecureBase/${var.environment}/Integrations/WebhookDeliveryFailures"
  log_group_names = ["/aws/lambda/securebase-production-webhook-manager"]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /failed|retry|error/i
    | sort @timestamp desc
    | limit 50
  EOQ
}

resource "aws_cloudwatch_query_definition" "billing_errors" {
  name = "SecureBase/${var.environment}/Business/BillingErrors"
  log_group_names = [
    "/aws/lambda/securebase-production-billing-worker",
    "/aws/lambda/securebase-checkout-api"
  ]

  query_string = <<-EOQ
    fields @timestamp, @message
    | filter @message like /error|failed|stripe/i
    | sort @timestamp desc
    | limit 50
  EOQ
}
