# ── terraform/modules/route53-failover/main.tf ────────────────────────────────
# Phase 6 / Track 2 — Sub-task 2.4: Route53 Health-Check-Based Failover
#
# Creates Route53 health checks on the primary and secondary API Gateway
# endpoints and configures a failover routing policy so traffic automatically
# shifts to the secondary region when the primary becomes unhealthy.
#
# Also provisions CloudWatch alarms that fire when either health check fails,
# and routes those alarms to an SNS topic for PagerDuty / Opsgenie notification.
#
# Resource overview:
#   - aws_route53_health_check.primary   — HTTPS check on primary endpoint
#   - aws_route53_health_check.secondary — HTTPS check on secondary endpoint
#   - aws_route53_record.api_primary     — PRIMARY failover record
#   - aws_route53_record.api_secondary   — SECONDARY failover record
#   - aws_cloudwatch_metric_alarm.primary_health_check_failed
#   - aws_cloudwatch_metric_alarm.secondary_health_check_failed
# ──────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Local values ───────────────────────────────────────────────────────────────

locals {
  module_tags = merge(var.tags, {
    phase     = "6"
    track     = "2"
    sub_task  = "2.4"
    module    = "route53-failover"
    ManagedBy = "terraform"
  })
}

# ── Route53 health check — primary region ─────────────────────────────────────
#
# Probes HTTPS /health on the primary API Gateway endpoint.
# Interval: 30 s (standard — lower cost than 10 s fast-interval checks).
# Failure threshold: 3 consecutive failures ≈ 90 s before marking unhealthy.

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_api_endpoint
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  request_interval  = var.health_check_interval_seconds
  failure_threshold = var.health_check_failure_threshold

  tags = merge(local.module_tags, {
    Name   = "securebase-${var.environment}-primary-health"
    Region = var.primary_region
  })
}

# ── Route53 health check — secondary region ───────────────────────────────────

resource "aws_route53_health_check" "secondary" {
  fqdn              = var.secondary_api_endpoint
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  request_interval  = var.health_check_interval_seconds
  failure_threshold = var.health_check_failure_threshold

  tags = merge(local.module_tags, {
    Name   = "securebase-${var.environment}-secondary-health"
    Region = var.secondary_region
  })
}

# ── Route53 failover records ───────────────────────────────────────────────────
#
# PRIMARY: actively serves traffic when healthy; Route53 routes away when the
#          health check fails.
# SECONDARY: receives traffic when the primary is marked unhealthy.

resource "aws_route53_record" "api_primary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
  type    = "CNAME"
  ttl     = var.dns_ttl

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  records         = [var.primary_api_endpoint]
  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "api_secondary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
  type    = "CNAME"
  ttl     = var.dns_ttl

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier  = "secondary"
  records         = [var.secondary_api_endpoint]
  health_check_id = aws_route53_health_check.secondary.id
}

# ── CloudWatch alarms: health check failure ───────────────────────────────────
#
# Route53 health checks publish HealthCheckStatus (0 = unhealthy, 1 = healthy)
# to CloudWatch in the us-east-1 region regardless of where the endpoint lives.

resource "aws_cloudwatch_metric_alarm" "primary_health_check_failed" {
  alarm_name          = "securebase-${var.environment}-route53-primary-health-failed"
  alarm_description   = "Route53 health check FAILED for primary API endpoint (${var.primary_api_endpoint}). Failover to ${var.secondary_region} may be in progress."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = local.module_tags
}

resource "aws_cloudwatch_metric_alarm" "secondary_health_check_failed" {
  alarm_name          = "securebase-${var.environment}-route53-secondary-health-failed"
  alarm_description   = "Route53 health check FAILED for secondary API endpoint (${var.secondary_api_endpoint}). Secondary failover target is unavailable."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.secondary.id
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = local.module_tags
}
