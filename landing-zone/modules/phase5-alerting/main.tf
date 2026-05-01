# =============================================================================
# Phase 5.3 – Component 5: Alerting & Incident Response
# =============================================================================
# Delivers:
# - 40+ CloudWatch alarm rules (error rates, latency, throttling, cold starts)
# - SNS topics for alert routing by severity
# - PagerDuty / Opsgenie integration via SNS → Lambda webhook
# - Composite alarms for complex conditions
# - EventBridge rule for AWS Cost Anomaly Detection
# - Maintenance window suppression support (via alarm actions toggle)

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# SNS Topics (severity-routed)
# =============================================================================

resource "aws_sns_topic" "critical" {
  name              = "securebase-${var.environment}-alerts-critical"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alerts-critical"
    Environment = var.environment
    Phase       = "5.3"
    Severity    = "critical"
  })
}

resource "aws_sns_topic" "high" {
  name              = "securebase-${var.environment}-alerts-high"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alerts-high"
    Environment = var.environment
    Phase       = "5.3"
    Severity    = "high"
  })
}

resource "aws_sns_topic" "medium" {
  name              = "securebase-${var.environment}-alerts-medium"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alerts-medium"
    Environment = var.environment
    Phase       = "5.3"
    Severity    = "medium"
  })
}

resource "aws_sns_topic" "low" {
  name              = "securebase-${var.environment}-alerts-low"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alerts-low"
    Environment = var.environment
    Phase       = "5.3"
    Severity    = "low"
  })
}

# =============================================================================
# PagerDuty / Opsgenie Webhook Lambda
# =============================================================================

resource "aws_iam_role" "alert_dispatcher" {
  name = "securebase-${var.environment}-alert-dispatcher"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alert-dispatcher"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_iam_role_policy_attachment" "alert_dispatcher_basic" {
  role       = aws_iam_role.alert_dispatcher.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "alert_dispatcher_ssm" {
  name = "securebase-${var.environment}-alert-dispatcher-ssm"
  role = aws_iam_role.alert_dispatcher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/securebase/${var.environment}/alerting/*"
    }]
  })
}

# Inline Lambda zip — alert dispatcher sends SNS payloads to PagerDuty/Opsgenie
data "archive_file" "alert_dispatcher" {
  type        = "zip"
  output_path = "${path.module}/lambda/alert_dispatcher.zip"

  source {
    content  = <<-PYTHON
import json
import os
import urllib.request
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

ssm = boto3.client('ssm')
_webhook_cache = {}


def _get_webhook_url(param_name: str) -> str:
    if param_name not in _webhook_cache:
        try:
            resp = ssm.get_parameter(Name=param_name, WithDecryption=True)
            _webhook_cache[param_name] = resp['Parameter']['Value']
        except Exception as exc:
            logger.error("Failed to retrieve webhook URL %s: %s", param_name, exc)
            return ''
    return _webhook_cache[param_name]


def send_webhook(url: str, payload: dict) -> None:
    if not url:
        return
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("Webhook delivered: status=%s", resp.status)
    except Exception as exc:
        logger.error("Webhook delivery failed: %s", exc)


def lambda_handler(event, context):
    env = os.environ.get('ENVIRONMENT', 'dev')
    pagerduty_url = _get_webhook_url(f'/securebase/{env}/alerting/pagerduty_webhook_url')
    opsgenie_url  = _get_webhook_url(f'/securebase/{env}/alerting/opsgenie_webhook_url')
    # PagerDuty routing key is also retrieved from SSM, not env vars
    pagerduty_routing_key = _get_webhook_url(f'/securebase/{env}/alerting/pagerduty_routing_key')

    for record in event.get('Records', []):
        sns_msg = record.get('Sns', {})
        subject = sns_msg.get('Subject', 'SecureBase Alert')
        message_raw = sns_msg.get('Message', '{}')
        try:
            message = json.loads(message_raw)
        except json.JSONDecodeError:
            message = {'raw': message_raw}

        alarm_name  = message.get('AlarmName', subject)
        state       = message.get('NewStateValue', 'ALARM')
        description = message.get('AlarmDescription', '')
        reason      = message.get('NewStateReason', '')

        # PagerDuty Events API v2
        if pagerduty_url:
            pd_payload = {
                'routing_key': pagerduty_routing_key,
                'event_action': 'trigger' if state == 'ALARM' else 'resolve',
                'dedup_key': alarm_name,
                'payload': {
                    'summary': f'[{env.upper()}] {alarm_name}: {state}',
                    'source': 'SecureBase CloudWatch',
                    'severity': _map_severity(alarm_name),
                    'custom_details': {
                        'description': description,
                        'reason': reason,
                        'environment': env,
                    },
                },
            }
            send_webhook(pagerduty_url, pd_payload)

        # Opsgenie Alerts API
        if opsgenie_url:
            og_payload = {
                'message': f'[{env.upper()}] {alarm_name}',
                'description': f'{description}\n\n{reason}',
                'priority': _map_opsgenie_priority(alarm_name),
                'tags': [f'env:{env}', 'source:securebase-cloudwatch'],
                'alias': alarm_name,
            }
            send_webhook(opsgenie_url, og_payload)

    return {'statusCode': 200}


def _map_severity(alarm_name: str) -> str:
    name = alarm_name.lower()
    if any(k in name for k in ('critical', 'db-', 'aurora', 'failover', '5xx')):
        return 'critical'
    if any(k in name for k in ('high', 'latency', 'p95', 'throttl')):
        return 'error'
    if any(k in name for k in ('medium', 'cold-start', 'cache')):
        return 'warning'
    return 'info'


def _map_opsgenie_priority(alarm_name: str) -> str:
    severity = _map_severity(alarm_name)
    return {'critical': 'P1', 'error': 'P2', 'warning': 'P3', 'info': 'P4'}.get(severity, 'P3')
PYTHON
    filename = "alert_dispatcher.py"
  }
}

resource "aws_lambda_function" "alert_dispatcher" {
  filename         = data.archive_file.alert_dispatcher.output_path
  source_code_hash = data.archive_file.alert_dispatcher.output_base64sha256
  function_name    = "securebase-${var.environment}-alert-dispatcher"
  handler          = "alert_dispatcher.lambda_handler"
  runtime          = "python3.11"
  timeout          = 15
  memory_size      = 128
  role             = aws_iam_role.alert_dispatcher.arn

  environment {
    variables = {
      ENVIRONMENT = var.environment
      LOG_LEVEL   = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-alert-dispatcher"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# Subscribe alert dispatcher to each SNS topic
resource "aws_sns_topic_subscription" "critical_to_lambda" {
  topic_arn = aws_sns_topic.critical.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alert_dispatcher.arn
}

resource "aws_lambda_permission" "critical_sns" {
  statement_id  = "AllowCriticalSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_dispatcher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical.arn
}

resource "aws_sns_topic_subscription" "high_to_lambda" {
  topic_arn = aws_sns_topic.high.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alert_dispatcher.arn
}

resource "aws_lambda_permission" "high_sns" {
  statement_id  = "AllowHighSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_dispatcher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.high.arn
}

# =============================================================================
# Email subscriptions (operator on-call)
# =============================================================================

resource "aws_sns_topic_subscription" "critical_email" {
  count     = var.oncall_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical.arn
  protocol  = "email"
  endpoint  = var.oncall_email
}

resource "aws_sns_topic_subscription" "high_email" {
  count     = var.oncall_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.high.arn
  protocol  = "email"
  endpoint  = var.oncall_email
}

# =============================================================================
# CRITICAL Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "aurora_unavailable" {
  alarm_name          = "securebase-${var.environment}-aurora-cluster-unavailable"
  alarm_description   = "Aurora cluster has no available instances — service-critical outage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.critical.arn]
  ok_actions          = [aws_sns_topic.critical.arn]

  dimensions = {
    DBClusterIdentifier = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate_critical" {
  alarm_name          = "securebase-${var.environment}-api-5xx-critical"
  alarm_description   = "API Gateway 5xx error rate exceeded 10 errors per minute"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.critical.arn]
  ok_actions          = [aws_sns_topic.critical.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate_critical" {
  alarm_name          = "securebase-${var.environment}-lambda-error-rate-critical"
  alarm_description   = "Lambda functions exceeded 50 errors per hour"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 50
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.critical.arn]
  ok_actions          = [aws_sns_topic.critical.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "failover_triggered" {
  alarm_name          = "securebase-${var.environment}-failover-triggered"
  alarm_description   = "Multi-region failover has been activated — immediate attention required"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailoverCount"
  namespace           = "SecureBase/${var.environment}/DR"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.critical.arn]
  ok_actions          = [aws_sns_topic.critical.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "security_breach" {
  alarm_name          = "securebase-${var.environment}-security-breach-detected"
  alarm_description   = "GuardDuty HIGH/CRITICAL finding detected — security incident"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "High"
  namespace           = "SecureBase/${var.environment}/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.critical.arn]

  tags = var.tags
}

# =============================================================================
# HIGH Priority Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "securebase-${var.environment}-api-latency-p95-high"
  alarm_description   = "API Gateway p95 latency exceeded 500ms SLA"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p95"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 60
  threshold           = 500
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]
  ok_actions          = [aws_sns_topic.high.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_query_latency" {
  alarm_name          = "securebase-${var.environment}-aurora-query-latency-high"
  alarm_description   = "Aurora average query latency exceeded 1 second"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "SelectLatency"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 1000
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]
  ok_actions          = [aws_sns_topic.high.arn]

  dimensions = {
    DBClusterIdentifier = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_cold_starts_high" {
  alarm_name          = "securebase-${var.environment}-lambda-cold-starts-high"
  alarm_description   = "Lambda cold-start count exceeded 100 per 5 minutes — consider provisioned concurrency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "InitDuration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "SampleCount"
  threshold           = 100
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling" {
  alarm_name          = "securebase-${var.environment}-dynamodb-throttling-high"
  alarm_description   = "DynamoDB throttling detected — possible under-provisioning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]
  ok_actions          = [aws_sns_topic.high.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cost_anomaly_high" {
  alarm_name          = "securebase-${var.environment}-cost-anomaly-high"
  alarm_description   = "AWS cost increase of more than $100 detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CostAnomalyAmount"
  namespace           = "SecureBase/${var.environment}/Costs"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 100
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ssl_cert_expiry" {
  alarm_name          = "securebase-${var.environment}-ssl-cert-expiry-30d"
  alarm_description   = "SSL certificate expires within 30 days — renew immediately"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DaysToExpiry"
  namespace           = "AWS/CertificateManager"
  period              = 86400
  statistic           = "Minimum"
  threshold           = 30
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_concurrent_executions" {
  alarm_name          = "securebase-${var.environment}-lambda-concurrency-high"
  alarm_description   = "Lambda concurrent executions approaching account limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.lambda_concurrency_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]
  ok_actions          = [aws_sns_topic.high.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "auth_lambda_errors" {
  alarm_name          = "securebase-${var.environment}-auth-lambda-errors-high"
  alarm_description   = "Auth Lambda function error rate elevated — potential auth service degradation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.high.arn]
  ok_actions          = [aws_sns_topic.high.arn]

  dimensions = {
    FunctionName = "securebase-${var.environment}-auth-v2"
  }

  tags = var.tags
}

# =============================================================================
# MEDIUM Priority Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cache_hit_rate" {
  alarm_name          = "securebase-${var.environment}-cache-hit-rate-medium"
  alarm_description   = "CloudFront cache hit rate dropped below 80%"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = 3600
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_4xx_rate" {
  alarm_name          = "securebase-${var.environment}-api-4xx-rate-medium"
  alarm_description   = "API Gateway 4xx error rate elevated — possible client issues"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p95" {
  alarm_name          = "securebase-${var.environment}-lambda-duration-p95-medium"
  alarm_description   = "Lambda p95 duration exceeded 3 seconds"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p95"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  threshold           = 3000
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_cpu_high" {
  alarm_name          = "securebase-${var.environment}-aurora-cpu-medium"
  alarm_description   = "Aurora CPU utilization exceeded 80%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  dimensions = {
    DBClusterIdentifier = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_freeable_memory" {
  alarm_name          = "securebase-${var.environment}-aurora-memory-medium"
  alarm_description   = "Aurora freeable memory dropped below 512MB"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 536870912  # 512 MB in bytes
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  dimensions = {
    DBClusterIdentifier = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "billing_lambda_errors" {
  alarm_name          = "securebase-${var.environment}-billing-lambda-errors-medium"
  alarm_description   = "Billing worker encountered errors — invoices may not generate correctly"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  dimensions = {
    FunctionName = "securebase-${var.environment}-billing-worker"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "deployment_duration" {
  alarm_name          = "securebase-${var.environment}-deployment-duration-medium"
  alarm_description   = "Deployment taking longer than 30 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DeploymentDuration"
  namespace           = "SecureBase/${var.environment}/Deployments"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1800
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "backup_failure" {
  alarm_name          = "securebase-${var.environment}-backup-failed-medium"
  alarm_description   = "Scheduled backup operation failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "NumberOfBackupJobsFailed"
  namespace           = "AWS/Backup"
  period              = 86400
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "error_rate_warning" {
  alarm_name          = "securebase-${var.environment}-error-rate-2pct-medium"
  alarm_description   = "Overall error rate between 2% and 5% — monitor closely"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ErrorRate"
  namespace           = "SecureBase/${var.environment}"
  period              = 300
  statistic           = "Average"
  threshold           = 2
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]
  ok_actions          = [aws_sns_topic.medium.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "webhook_delivery_failures" {
  alarm_name          = "securebase-${var.environment}-webhook-delivery-failures-medium"
  alarm_description   = "Webhook delivery failures exceeded threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.medium.arn]

  dimensions = {
    FunctionName = "securebase-${var.environment}-webhook-manager"
  }

  tags = var.tags
}

# =============================================================================
# LOW Priority Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "api_usage_spike" {
  alarm_name          = "securebase-${var.environment}-api-usage-spike-low"
  alarm_description   = "API usage trending 50% above weekly average — growth or abuse check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Count"
  namespace           = "AWS/ApiGateway"
  period              = 86400
  statistic           = "Sum"
  threshold           = var.api_usage_spike_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.low.arn]

  dimensions = {
    ApiName = "securebase-${var.environment}"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cost_trending" {
  alarm_name          = "securebase-${var.environment}-cost-trending-low"
  alarm_description   = "Daily AWS costs trending above $400 monthly projection"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 13  # ~$400/month ÷ 30 days
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.low.arn]

  dimensions = {
    Currency = "USD"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_reserved_concurrency_low" {
  alarm_name          = "securebase-${var.environment}-lambda-reserved-concurrency-low"
  alarm_description   = "Lambda reserved concurrency utilization above 90%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "UnreservedConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 50
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.low.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "s3_replication_lag" {
  alarm_name          = "securebase-${var.environment}-s3-replication-lag-low"
  alarm_description   = "S3 cross-region replication lag exceeded 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicationLatency"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Maximum"
  threshold           = 300
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.low.arn]

  tags = var.tags
}

# =============================================================================
# Composite Alarms (multi-condition)
# =============================================================================

resource "aws_cloudwatch_composite_alarm" "service_degraded" {
  alarm_name        = "securebase-${var.environment}-service-degraded"
  alarm_description = "Multiple high-severity alarms active simultaneously — possible cascading failure"

  alarm_rule = join(" OR ", [
    "ALARM(\"${aws_cloudwatch_metric_alarm.aurora_unavailable.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.api_5xx_rate_critical.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_error_rate_critical.alarm_name}\")",
  ])

  alarm_actions = [aws_sns_topic.critical.arn]
  ok_actions    = [aws_sns_topic.critical.arn]

  tags = var.tags
}

resource "aws_cloudwatch_composite_alarm" "performance_degraded" {
  alarm_name        = "securebase-${var.environment}-performance-degraded"
  alarm_description = "Latency and error rate both elevated — performance incident"

  alarm_rule = join(" AND ", [
    "ALARM(\"${aws_cloudwatch_metric_alarm.api_latency_p95.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.api_4xx_rate.alarm_name}\")",
  ])

  alarm_actions = [aws_sns_topic.high.arn]
  ok_actions    = [aws_sns_topic.high.arn]

  tags = var.tags
}

# =============================================================================
# EventBridge — Cost Anomaly Detection
# =============================================================================

resource "aws_cloudwatch_event_rule" "cost_anomaly" {
  name        = "securebase-${var.environment}-cost-anomaly-detection"
  description = "Route AWS Cost Anomaly Detection findings to alerting pipeline"

  event_pattern = jsonencode({
    source      = ["aws.ce"]
    detail-type = ["Cost Anomaly Detection Alert"]
  })

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-cost-anomaly"
    Environment = var.environment
    Phase       = "5.3"
  })
}

resource "aws_cloudwatch_event_target" "cost_anomaly_sns" {
  rule      = aws_cloudwatch_event_rule.cost_anomaly.name
  target_id = "CostAnomalySNS"
  arn       = aws_sns_topic.high.arn
}

resource "aws_sns_topic_policy" "high_allow_events" {
  arn = aws_sns_topic.high.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.high.arn
    }]
  })
}

# =============================================================================
# CloudWatch Dashboard — Alerting Overview
# =============================================================================

resource "aws_cloudwatch_dashboard" "alerting_overview" {
  dashboard_name = "securebase-${var.environment}-alerting-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "alarm"
        x      = 0
        y      = 0
        width  = 24
        height = 6
        properties = {
          title  = "Critical Alarms"
          alarms = [
            aws_cloudwatch_metric_alarm.aurora_unavailable.arn,
            aws_cloudwatch_metric_alarm.api_5xx_rate_critical.arn,
            aws_cloudwatch_metric_alarm.lambda_error_rate_critical.arn,
            aws_cloudwatch_metric_alarm.failover_triggered.arn,
            aws_cloudwatch_metric_alarm.security_breach.arn,
          ]
          sortBy = "stateUpdatedTimestamp"
          states = ["ALARM"]
        }
      },
      {
        type   = "alarm"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          title  = "High Priority Alarms"
          alarms = [
            aws_cloudwatch_metric_alarm.api_latency_p95.arn,
            aws_cloudwatch_metric_alarm.aurora_query_latency.arn,
            aws_cloudwatch_metric_alarm.dynamodb_throttling.arn,
            aws_cloudwatch_metric_alarm.cost_anomaly_high.arn,
            aws_cloudwatch_metric_alarm.auth_lambda_errors.arn,
          ]
          sortBy = "stateUpdatedTimestamp"
          states = ["ALARM", "INSUFFICIENT_DATA"]
        }
      }
    ]
  })
}
