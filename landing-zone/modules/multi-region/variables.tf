variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "primary_region" {
  description = "Primary AWS region (active)"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region (standby)"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "primary_kms_key_arn" {
  description = "ARN of the primary region KMS key used to encrypt DynamoDB tables and S3 buckets"
  type        = string
  default     = ""
}

variable "primary_bucket_arns" {
  description = "ARNs of the primary region S3 buckets to replicate"
  type        = list(string)
  default     = []
}

variable "secondary_bucket_arns" {
  description = "ARNs of the secondary region destination S3 buckets"
  type        = list(string)
  default     = []
}

variable "primary_api_fqdn" {
  description = "FQDN of the primary region API Gateway custom domain"
  type        = string
}

variable "secondary_api_fqdn" {
  description = "FQDN of the secondary region API Gateway custom domain"
  type        = string
}

variable "api_dns_name" {
  description = "DNS record name for the API endpoint (e.g. api.securebase.tximhotep.com)"
  type        = string
  default     = "api.securebase.tximhotep.com"
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the API DNS records"
  type        = string
}

variable "secondary_vpc_id" {
  description = "VPC ID in the secondary region"
  type        = string
}

variable "secondary_vpc_cidr" {
  description = "CIDR block of the secondary region VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "secondary_subnet_ids" {
  description = "Subnet IDs in the secondary region for Aurora and Lambda"
  type        = list(string)
  default     = []
}

variable "aurora_instance_class" {
  description = "Instance class for the secondary Aurora reader instance"
  type        = string
  default     = "db.serverless"
}

variable "cloudfront_aliases" {
  description = "Custom domain aliases for the CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
  default     = ""
}
