# =============================================================================
# Phase 5.4 – CloudFront Multi-Origin Failover
# DNS in Netlify. CloudFront sits in front of both API Gateway endpoints
# and retries against secondary on 5xx.
#
# Origin layout:
#   primary         — d-ky35u7ca93.execute-api.us-east-1.amazonaws.com
#   secondary       — bi8ixc75nl.execute-api.us-west-2.amazonaws.com
#   health-endpoint — secondary APIGWv2 /health Lambda (us-west-2)
#
# Behavior layout:
#   /health         → health-endpoint (direct, no failover group needed)
#   /api/*          → primary (direct, all HTTP methods, no caching)
#   default /*      → api-failover-group (GET/HEAD/OPTIONS only, auto-failover)
#
# AWS restriction: CloudFront origin groups only support GET/HEAD/OPTIONS
# in cached behaviors. POST/PUT/DELETE must use a separate behavior without
# an origin group.
# =============================================================================

locals {
  enable_cloudfront = (
    var.acm_certificate_arn       != "" &&
    var.primary_api_fqdn          != "" &&
    var.secondary_api_fqdn        != ""
  )
  # Health origin is optional — skipped when secondary health API not yet provisioned
  enable_health_origin = var.secondary_health_api_fqdn != ""
}

resource "aws_cloudfront_distribution" "api" {
  count           = local.enable_cloudfront ? 1 : 0
  enabled         = true
  is_ipv6_enabled = true
  comment         = "SecureBase ${var.environment} API — multi-origin failover"
  price_class     = "PriceClass_100"

  aliases = length(var.cloudfront_aliases) > 0 ? var.cloudfront_aliases : null

  # ---- Origins ----------------------------------------------------------------

  origin {
    origin_id   = "primary"
    domain_name = var.primary_api_fqdn
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "X-Origin-Region"
      value = var.primary_region
    }
  }

  origin {
    origin_id   = "secondary"
    domain_name = var.secondary_api_fqdn
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "X-Origin-Region"
      value = var.secondary_region
    }
  }

  # Secondary health Lambda (APIGWv2, us-west-2)
  # Provides api.securebase.tximhotep.com/health without adding routes
  # to the primary REST API.
  dynamic "origin" {
    for_each = local.enable_health_origin ? [1] : []
    content {
      origin_id   = "health-endpoint"
      domain_name = var.secondary_health_api_fqdn
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
      custom_header {
        name  = "X-Origin-Region"
        value = "${var.secondary_region}-health"
      }
    }
  }

  # ---- Origin group (read traffic failover) -----------------------------------

  origin_group {
    origin_id = "api-failover-group"
    failover_criteria {
      status_codes = [500, 502, 503, 504]
    }
    member { origin_id = "primary" }
    member { origin_id = "secondary" }
  }

  # ---- Cache behaviors --------------------------------------------------------

  # /health → secondary health Lambda (only when health origin configured)
  dynamic "ordered_cache_behavior" {
    for_each = local.enable_health_origin ? [1] : []
    content {
      path_pattern           = "/health"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "health-endpoint"
      viewer_protocol_policy = "redirect-to-https"
      compress               = true
      min_ttl                = 0
      default_ttl            = 0
      max_ttl                = 10  # short TTL — health status should be near-live

      forwarded_values {
        query_string = false
        headers      = []
        cookies { forward = "none" }
      }
    }
  }

  # /api/* → primary direct (all HTTP methods, no origin group, no caching)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "primary"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "X-API-Key", "X-Requested-With", "Origin"]
      cookies { forward = "none" }
    }
  }

  # default /* → origin group (GET/HEAD/OPTIONS, auto-failover on 5xx)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "api-failover-group"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 60

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "X-API-Key", "X-Requested-With"]
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.dr_tags
}
