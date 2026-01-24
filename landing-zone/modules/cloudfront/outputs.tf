# CloudFront Module Outputs

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.portal.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.portal.arn
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.portal.domain_name
}

output "distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID for Route53"
  value       = aws_cloudfront_distribution.portal.hosted_zone_id
}

output "origin_access_identity_iam_arn" {
  description = "IAM ARN of the CloudFront origin access identity"
  value       = aws_cloudfront_origin_access_identity.portal.iam_arn
}

output "cache_policy_id" {
  description = "ID of the API cache policy"
  value       = aws_cloudfront_cache_policy.api_cache.id
}

output "origin_request_policy_id" {
  description = "ID of the origin request policy"
  value       = aws_cloudfront_origin_request_policy.api_requests.id
}

output "response_headers_policy_id" {
  description = "ID of the security headers response policy"
  value       = aws_cloudfront_response_headers_policy.security_headers.id
}
