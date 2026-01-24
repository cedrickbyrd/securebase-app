# CloudFront Distribution for SecureBase Portal
# Provides global CDN for static assets and portal UI

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  s3_origin_id = "S3-${var.bucket_name}"
  api_origin_id = "API-${var.environment}"
}

# CloudFront Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "portal" {
  comment = "OAI for ${var.project_name}-${var.environment} portal"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "portal" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment} Portal CDN"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = var.custom_domain != "" ? [var.custom_domain] : []
  
  # S3 Origin for static assets
  origin {
    domain_name = var.bucket_regional_domain_name
    origin_id   = local.s3_origin_id

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.portal.cloudfront_access_identity_path
    }

    # Custom headers for origin requests
    custom_header {
      name  = "X-Environment"
      value = var.environment
    }
  }

  # API Gateway Origin for dynamic content
  dynamic "origin" {
    for_each = var.api_gateway_domain != "" ? [1] : []
    content {
      domain_name = var.api_gateway_domain
      origin_id   = local.api_origin_id
      origin_path = var.api_gateway_stage

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
        origin_read_timeout    = 60
        origin_keepalive_timeout = 5
      }

      custom_header {
        name  = "X-CloudFront-Secret"
        value = var.cloudfront_secret
      }
    }
  }

  # Default cache behavior for static assets
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600      # 1 hour
    max_ttl                = 86400     # 24 hours
    compress               = true

    # Lambda@Edge function for security headers (if provided)
    dynamic "lambda_function_association" {
      for_each = var.security_headers_lambda_arn != "" ? [1] : []
      content {
        event_type   = "viewer-response"
        lambda_arn   = var.security_headers_lambda_arn
        include_body = false
      }
    }
  }

  # Cache behavior for API requests
  dynamic "ordered_cache_behavior" {
    for_each = var.api_gateway_domain != "" ? [1] : []
    content {
      path_pattern     = "/api/*"
      allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods   = ["GET", "HEAD", "OPTIONS"]
      target_origin_id = local.api_origin_id

      forwarded_values {
        query_string = true
        headers      = ["Authorization", "X-API-Key", "Accept", "Content-Type"]

        cookies {
          forward = "none"
        }
      }

      viewer_protocol_policy = "https-only"
      min_ttl                = 0
      default_ttl            = var.api_cache_ttl
      max_ttl                = var.api_cache_ttl
      compress               = true

      # Cache based on query strings and specific headers
      cache_policy_id          = aws_cloudfront_cache_policy.api_cache.id
      origin_request_policy_id = aws_cloudfront_origin_request_policy.api_requests.id
    }
  }

  # Cache behavior for static assets with longer TTL
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400      # 1 day
    default_ttl            = 604800     # 7 days
    max_ttl                = 31536000   # 1 year
    compress               = true
  }

  # Cache behavior for versioned assets (immutable)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000   # 1 year (immutable)
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 0
  }

  # Geo restrictions (if needed)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS Certificate
  viewer_certificate {
    cloudfront_default_certificate = var.custom_domain == "" ? true : false
    acm_certificate_arn           = var.acm_certificate_arn
    minimum_protocol_version      = "TLSv1.2_2021"
    ssl_support_method            = var.custom_domain != "" ? "sni-only" : null
  }

  # Logging configuration
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      bucket          = var.logs_bucket
      prefix          = "cloudfront/${var.environment}/"
      include_cookies = false
    }
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-cdn"
      Environment = var.environment
      Component   = "cloudfront"
      ManagedBy   = "terraform"
    }
  )
}

# Cache Policy for API requests
resource "aws_cloudfront_cache_policy" "api_cache" {
  name        = "${var.project_name}-${var.environment}-api-cache"
  comment     = "Cache policy for API Gateway with query string support"
  min_ttl     = 0
  default_ttl = var.api_cache_ttl
  max_ttl     = var.api_cache_ttl

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "X-API-Key", "Accept"]
      }
    }

    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# Origin Request Policy for API Gateway
resource "aws_cloudfront_origin_request_policy" "api_requests" {
  name    = "${var.project_name}-${var.environment}-api-requests"
  comment = "Forward necessary headers to API Gateway"

  cookies_config {
    cookie_behavior = "none"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Authorization",
        "X-API-Key",
        "Accept",
        "Content-Type",
        "User-Agent",
        "Referer"
      ]
    }
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# Response Headers Policy for security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.project_name}-${var.environment}-security-headers"
  comment = "Security headers for portal"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }

  custom_headers_config {
    items {
      header   = "X-Environment"
      value    = var.environment
      override = false
    }

    items {
      header   = "Cache-Control"
      value    = "public, max-age=31536000, immutable"
      override = false
    }
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-cloudfront-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1.0
  alarm_description   = "CloudFront 5xx error rate > 1%"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.portal.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_4xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-cloudfront-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5.0
  alarm_description   = "CloudFront 4xx error rate > 5%"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.portal.id
  }

  tags = var.tags
}

# S3 Bucket Policy to allow CloudFront access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = var.bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.portal.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${var.bucket_arn}/*"
      }
    ]
  })
}
