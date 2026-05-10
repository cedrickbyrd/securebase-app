# =============================================================================
# Phase 5.4 – CloudFront Multi-Origin Failover
# DNS in Netlify. CloudFront sits in front of both API Gateway endpoints
# and retries against secondary on 5xx.
#
# NOTE: CloudFront origin groups only support GET/HEAD/OPTIONS in the
# cached behavior (AWS limitation). POST/PUT/DELETE must use a separate
# non-cached behavior that does NOT use an origin group.
# The failover pattern here is: read traffic uses the origin group for
# automatic failover; write traffic goes directly to primary with
# very short TTL (effectively pass-through).
# =============================================================================

locals {
  enable_cloudfront = (
    var.acm_certificate_arn != "" &&
    var.primary_api_fqdn    != "" &&
    var.secondary_api_fqdn  != ""
  )
}

resource "aws_cloudfront_distribution" "api" {
  count           = local.enable_cloudfront ? 1 : 0
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
    member { origin_id = "primary" }
    member { origin_id = "secondary" }
  }

  # Read behavior — uses origin group for automatic failover
  # CloudFront origin groups only allow GET/HEAD/OPTIONS
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

  # Write behavior — POST/PUT/PATCH/DELETE go directly to primary
  # (origin groups not supported for write methods by AWS)
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
