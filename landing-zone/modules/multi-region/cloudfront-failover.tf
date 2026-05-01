# =============================================================================
# Phase 5.3 – Component 6: Multi-Region DR
# CloudFront Multi-Origin Failover
# =============================================================================

resource "aws_cloudfront_origin_group" "api" {
  origin_id = "securebase-${var.environment}-api-failover-group"

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

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "SecureBase ${var.environment} API — multi-origin failover"
  price_class     = "PriceClass_100"  # US, Canada, Europe

  aliases = var.cloudfront_aliases

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

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = aws_cloudfront_origin_group.api.origin_id
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
    default_ttl = 0   # API responses are not cached by default
    max_ttl     = 60

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
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

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-api-cdn"
    Environment = var.environment
    Phase       = "5.3"
  })
}

# Security headers CloudFront Function
resource "aws_cloudfront_function" "security_headers" {
  name    = "securebase-${var.environment}-security-headers"
  runtime = "cloudfront-js-2.0"
  publish = true

  code = <<-JS
    function handler(event) {
      var request = event.request;
      var headers = request.headers;

      // Strip internal headers before forwarding
      delete headers['x-origin-region'];

      return request;
    }
  JS
}
