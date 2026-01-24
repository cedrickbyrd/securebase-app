# CloudFront Module Variables

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "securebase"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket containing portal assets"
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket"
  type        = string
}

variable "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain for CloudFront (e.g., portal.securebase.com)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"  # US, Canada, Europe
}

variable "api_gateway_domain" {
  description = "API Gateway custom domain or default domain"
  type        = string
  default     = ""
}

variable "api_gateway_stage" {
  description = "API Gateway stage path"
  type        = string
  default     = "/v1"
}

variable "api_cache_ttl" {
  description = "Cache TTL for API requests in seconds"
  type        = number
  default     = 300  # 5 minutes
}

variable "cloudfront_secret" {
  description = "Secret header value to verify requests from CloudFront to API Gateway"
  type        = string
  sensitive   = true
  default     = ""
}

variable "security_headers_lambda_arn" {
  description = "Lambda@Edge ARN for security headers (must include version)"
  type        = string
  default     = ""
}

variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

variable "logs_bucket" {
  description = "S3 bucket for CloudFront access logs"
  type        = string
  default     = ""
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
