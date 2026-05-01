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
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
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
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id
  records         = [var.primary_api_fqdn]
}

# Secondary — standby
resource "aws_route53_record" "api_secondary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "SECONDARY"
  }

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
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }

  tags = var.tags
}
