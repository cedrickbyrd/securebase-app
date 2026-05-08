# ── multi-region module variables ────────────────────────────────────────────
# Merged from HEAD (networking/CloudFront vars) and feat/phase5.3 (DR service vars)

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

# ── Aurora ────────────────────────────────────────────────────────────────────

variable "aurora_cluster_id" {
  description = "Existing Aurora cluster identifier in the primary region"
  type        = string
}

variable "aurora_engine_version" {
  description = "Aurora MySQL engine version"
  type        = string
  default     = "8.0.mysql_aurora.3.04.0"
}

variable "aurora_instance_class" {
  description = "Instance class for the secondary Aurora reader instance"
  type        = string
  default     = "db.serverless"
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────

variable "dynamodb_table_names" {
  description = "DynamoDB tables to add us-west-2 replicas to"
  type        = list(string)
  default = [
    "securebase-users",
    "securebase-cache-dev",
    "securebase-dev-notifications",
    "securebase-dev-support-tickets",
    "securebase-dev-reports",
    "securebase-dev-metrics",
  ]
}

# ── S3 replication ────────────────────────────────────────────────────────────

variable "s3_replication_buckets" {
  description = "Map of source bucket name → replica bucket name for cross-region replication"
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

# ── Networking (secondary region) ─────────────────────────────────────────────

variable "secondary_vpc_id" {
  description = "VPC ID in the secondary region"
  type        = string
  default     = ""
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

# ── API Gateway / Route53 ─────────────────────────────────────────────────────

variable "primary_api_fqdn" {
  description = "FQDN of the primary region API Gateway custom domain"
  type        = string
  default     = ""
}

variable "secondary_api_fqdn" {
  description = "FQDN of the secondary region API Gateway custom domain"
  type        = string
  default     = ""
}

variable "primary_api_endpoint" {
  description = "Primary region API Gateway invoke URL (used for Route53 health check target)"
  type        = string
  default     = ""
}

variable "secondary_api_endpoint" {
  description = "Secondary region API Gateway invoke URL (used for Route53 failover record)"
  type        = string
  default     = ""
}

variable "secondary_api_gateway_id" {
  description = "Secondary region API Gateway REST API ID used by DR health checks"
  type        = string
  default     = ""
}

variable "api_dns_name" {
  description = "DNS record name for the API endpoint"
  type        = string
  default     = "api.securebase.tximhotep.com"
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the API DNS records"
  type        = string
  default     = ""
}

variable "route53_hosted_zone_id" {
  description = "Alias for hosted_zone_id — kept for backwards compatibility"
  type        = string
  default     = ""
}

# ── CloudFront ────────────────────────────────────────────────────────────────

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

# ── Alerting ──────────────────────────────────────────────────────────────────

variable "alert_sns_arn" {
  description = "SNS topic ARN for DR alerts (from phase5-alerting output)"
  type        = string
  default     = ""
}

# ── Tags ──────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
