<<<<<<< HEAD
# =============================================================================
# Phase 5.3 – Component 6: Multi-Region DR
# Route 53 Health Checks & Failover Routing
# =============================================================================
# Implements active/standby DNS failover:
#   Primary:   api.securebase.tximhotep.com → us-east-1 API Gateway
#   Secondary: api.securebase.tximhotep.com → us-west-2 API Gateway (failover)

# =============================================================================
# Health Check — Primary Region
# =============================================================================

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_api_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-primary-health"
    Environment = var.environment
    Phase       = "5.3"
    Region      = var.primary_region
    Role        = "primary"
  })
}

# Health Check — Secondary Region
resource "aws_route53_health_check" "secondary" {
  fqdn              = var.secondary_api_fqdn
=======
# ── Route53 health check + failover routing ───────────────────────────────────
# APPLY ORDER: After aurora-global.tf and after secondary API GW is deployed.
# Requires var.route53_hosted_zone_id and both API endpoints to be set.

resource "aws_route53_health_check" "primary" {
  count = var.route53_hosted_zone_id != "" && var.primary_api_endpoint != "" ? 1 : 0

  fqdn              = var.primary_api_endpoint
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
<<<<<<< HEAD
  request_interval  = 30

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-secondary-health"
    Environment = var.environment
    Phase       = "5.3"
    Region      = var.secondary_region
    Role        = "secondary"
  })
}

# =============================================================================
# Route 53 Failover Records
# =============================================================================

# Primary — active
resource "aws_route53_record" "api_primary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
=======
  request_interval  = 10

  tags = merge(local.dr_tags, { Name = "securebase-${var.environment}-primary-health" })
}

resource "aws_route53_record" "api_primary" {
  count = var.route53_hosted_zone_id != "" && var.primary_api_endpoint != "" ? 1 : 0

  zone_id = var.route53_hosted_zone_id
  name    = "api.securebase.tximhotep.com"
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
<<<<<<< HEAD
  health_check_id = aws_route53_health_check.primary.id
  records         = [var.primary_api_fqdn]
}

# Secondary — standby
resource "aws_route53_record" "api_secondary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
=======
  records         = [var.primary_api_endpoint]
  health_check_id = aws_route53_health_check.primary[0].id
}

resource "aws_route53_record" "api_secondary" {
  count = var.route53_hosted_zone_id != "" && var.secondary_api_endpoint != "" ? 1 : 0

  zone_id = var.route53_hosted_zone_id
  name    = "api.securebase.tximhotep.com"
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "SECONDARY"
  }

<<<<<<< HEAD
  set_identifier  = "secondary"
  health_check_id = aws_route53_health_check.secondary.id
  records         = [var.secondary_api_fqdn]
}

# =============================================================================
# CloudWatch Alarm — health check failure triggers failover notification
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "primary_health_failed" {
  # Route 53 health check metrics are always in us-east-1
  provider = aws.primary

  alarm_name          = "securebase-${var.environment}-primary-health-failed"
  alarm_description   = "Primary region health check failing — Route 53 failover may activate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
=======
  set_identifier = "secondary"
  records        = [var.secondary_api_endpoint]
}

# ── CloudWatch alarm: primary health check failing ────────────────────────────
resource "aws_cloudwatch_metric_alarm" "primary_health_check" {
  count = var.route53_hosted_zone_id != "" && var.primary_api_endpoint != "" ? 1 : 0

  alarm_name          = "securebase-${var.environment}-primary-region-unhealthy"
  alarm_description   = "Primary region health check failing — failover may be needed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

<<<<<<< HEAD
  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }

  tags = var.tags
=======
  dimensions = { HealthCheckId = aws_route53_health_check.primary[0].id }

  alarm_actions = var.alert_sns_arn != "" ? [var.alert_sns_arn] : []

  tags = local.dr_tags
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}
