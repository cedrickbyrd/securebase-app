# =============================================================================
# Phase 5.4 – CloudFront Multi-Origin Failover
# DNS remains in Netlify. CloudFront sits in front of both API Gateway
# endpoints and automatically retries against the secondary on 5xx.
# Guard: only created when acm_certificate_arn and both FQDNs are set.
# =============================================================================

locals {
  enable_cloudfront = (
    var.acm_certificate_arn != "" &&
    var.primary_api_fqdn    != "" &&
    var.secondary_api_fqdn  != ""
  )
}

# CloudFront does not support aws_cloudfront_origin_group as a standalone
# resource in all provider versions. Origin failover is configured inline
# inside the distribution using origin_group blocks.

resource "aws_cloudfront_distribution" "api" {
  count   = local.enable_cloudfront ? 1 : 0
  enabled         = true
  is_ipv6_enabled = true
  comment         = "SecureBase ${var.environment} API — multi-origin failover"
  price_class     = "PriceClass_100"

  aliases = length(var.cloudfront_aliases) > 0 ? var.cloudfront_aliases : null

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

  origin_group {
    origin_id = "api-failover-group"

    failover_criteria {
      status_codes = [500, 502, 503, 504]
    }

    member {
      origin_id = "primary"
    }

    member {
      origin_id = "secondary"
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "api-failover-group"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "X-API-Key", "X-Requested-With"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.dr_tags
}
