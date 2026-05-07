# ── Route 53 health checks + failover routing ────────────────────────────────
# Guard: all resources are skipped until route53_hosted_zone_id AND both API
# endpoints are configured in tfvars.
# APPLY ORDER: after aurora-global.tf and after the secondary API GW is deployed.

locals {
  enable_route53 = (
    var.route53_hosted_zone_id != "" &&
    var.primary_api_endpoint   != "" &&
    var.secondary_api_endpoint != ""
  )
}

resource "aws_route53_health_check" "primary" {
  count = local.enable_route53 ? 1 : 0

  fqdn              = var.primary_api_endpoint
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10

  tags = merge(local.dr_tags, { Name = "securebase-${var.environment}-primary-health" })
}

resource "aws_route53_health_check" "secondary" {
  count = local.enable_route53 ? 1 : 0

  fqdn              = var.secondary_api_endpoint
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10

  tags = merge(local.dr_tags, { Name = "securebase-${var.environment}-secondary-health" })
}

resource "aws_route53_record" "api_primary" {
  count = local.enable_route53 ? 1 : 0

  zone_id = var.route53_hosted_zone_id
  name    = var.api_dns_name
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  records         = [var.primary_api_endpoint]
  health_check_id = aws_route53_health_check.primary[0].id
}

resource "aws_route53_record" "api_secondary" {
  count = local.enable_route53 ? 1 : 0

  zone_id = var.route53_hosted_zone_id
  name    = var.api_dns_name
  type    = "CNAME"
  ttl     = 60

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier  = "secondary"
  records         = [var.secondary_api_endpoint]
  health_check_id = aws_route53_health_check.secondary[0].id
}
