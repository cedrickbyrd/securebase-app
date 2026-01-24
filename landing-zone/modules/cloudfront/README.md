# CloudFront CDN Module

This Terraform module creates a CloudFront distribution for the SecureBase customer portal with optimized caching policies and security headers.

## Features

- **Global CDN**: Distribute portal assets globally with low latency
- **Multi-origin support**: S3 for static assets, API Gateway for dynamic content  
- **Optimized caching**: Different cache policies for static assets, API requests, and versioned content
- **Security headers**: HSTS, CSP, X-Frame-Options, etc.
- **Gzip/Brotli compression**: Automatic compression for faster downloads
- **Custom domain support**: Use your own domain with ACM certificates
- **SPA routing**: Custom error handling for single-page application routes
- **CloudWatch monitoring**: Alarms for 4xx/5xx errors

## Usage

```hcl
module "cloudfront" {
  source = "./modules/cloudfront"
  
  environment                  = "prod"
  bucket_name                  = "securebase-prod-portal"
  bucket_arn                   = aws_s3_bucket.portal.arn
  bucket_regional_domain_name  = aws_s3_bucket.portal.bucket_regional_domain_name
  
  # Optional: Custom domain
  custom_domain        = "portal.securebase.com"
  acm_certificate_arn  = "arn:aws:acm:us-east-1:123456789012:certificate/abc123"
  
  # Optional: API Gateway integration
  api_gateway_domain   = "api.securebase.com"
  api_gateway_stage    = "/v1"
  api_cache_ttl        = 300
  
  # Optional: Logging
  enable_logging       = true
  logs_bucket          = "securebase-logs.s3.amazonaws.com"
  
  alarm_sns_topic_arn  = aws_sns_topic.alerts.arn
  
  tags = {
    Project = "SecureBase"
    Tier    = "Premium"
  }
}
```

## Cache Behaviors

The module configures multiple cache behaviors optimized for different content types:

| Path Pattern | TTL | Use Case |
|--------------|-----|----------|
| `/` (default) | 1 hour | HTML pages, dynamic content |
| `/assets/*` | 1 year | Versioned JS/CSS bundles (immutable) |
| `/static/*` | 7 days | Images, fonts, icons |
| `/api/*` | 5 min | API proxy requests (if configured) |

## Performance Optimizations

- **Compression**: Gzip and Brotli enabled for all text-based content
- **HTTP/2**: Enabled by default for faster multiplexing
- **Edge locations**: PriceClass_100 covers US, Canada, Europe (configurable)
- **Origin keepalive**: 5-second keepalive to reuse connections
- **Viewer protocol**: HTTPS enforced with TLS 1.2+ minimum

## Security Features

- **Origin Access Identity (OAI)**: Restricts S3 bucket to CloudFront only
- **Security headers**: Automatically added via response headers policy
  - `Strict-Transport-Security`: Force HTTPS for 1 year
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Custom secret header**: Verify requests from CloudFront to API Gateway
- **Geo-restrictions**: Optional country-level blocking

## Monitoring

CloudWatch alarms are created for:

- **5xx error rate > 1%**: Backend errors
- **4xx error rate > 5%**: Client errors (possible DDoS or misconfiguration)

Access CloudFront metrics in CloudWatch under the `AWS/CloudFront` namespace.

## Cost Optimization

- **PriceClass_100**: Default to US/Canada/Europe edge locations (~50% cost savings)
- **Intelligent caching**: Longer TTLs for static/versioned assets
- **Compression**: Reduces data transfer costs by 60-80%

### Estimated Monthly Cost (1TB transfer)

| Price Class | Edge Locations | Cost |
|-------------|---------------|------|
| 100 | US, CA, EU | ~$85 |
| 200 | Above + Asia | ~$120 |
| All | Global | ~$170 |

## Inputs

See [variables.tf](./variables.tf) for complete list.

## Outputs

- `distribution_id`: CloudFront distribution ID
- `distribution_domain_name`: CloudFront domain (e.g., `d1234abcd.cloudfront.net`)
- `distribution_arn`: ARN for IAM policies
- `cache_policy_id`: Reusable cache policy ID
- `origin_request_policy_id`: Reusable origin request policy ID

## Cache Invalidation

Invalidate cache after deployments:

```bash
aws cloudfront create-invalidation \
  --distribution-id E1234ABCD5678 \
  --paths "/*"
```

**Note**: First 1,000 invalidations/month are free, then $0.005 per path.

## SPA Routing

The module redirects 404/403 errors to `/index.html` for client-side routing (React Router, Vue Router, etc).

## Troubleshooting

**Error: "CloudFront OAI cannot access S3 bucket"**
- Verify the S3 bucket policy allows the OAI IAM ARN
- Check bucket is in the same AWS account

**High 4xx error rate**
- Check API Gateway integration if using `/api/*` path
- Verify S3 bucket contains expected files

**Slow cache hit rate**
- Review cache policies and TTLs
- Check CloudWatch metrics for cache statistics

## Related Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Cache Policy Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)
