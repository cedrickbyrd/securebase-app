# ── multi-region module variables ——————————————————————————————

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

# ── Aurora ─────────────────────────────────────────────────────────────────────────────

variable "aurora_cluster_id" {
  description = "Existing Aurora cluster identifier in the primary region"
  type        = string
  default     = ""
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.15"
}

variable "aurora_instance_class" {
  description = "Instance class for the secondary Aurora reader instance"
  type        = string
  default     = "db.r6g.large"
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────────────

variable "dynamodb_table_names" {
  description = "DynamoDB tables to add us-west-2 replicas to"
  type        = list(string)
  default     = []
}

# ── S3 replication ────────────────────────────────────────────────────────────────────

variable "audit_log_bucket_name" {
  description = "Source S3 bucket name for audit log cross-region replication"
  type        = string
  default     = ""
}

variable "s3_replication_buckets" {
  description = "Map of source bucket name to replica bucket name for CRR"
  type        = map(string)
  default     = {}
}

variable "primary_kms_key_arn" {
  description = "ARN of the primary region KMS key"
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

# ── Networking ──────────────────────────────────────────────────────────────────────

variable "primary_vpc_id" {
  description = "VPC ID in the primary region"
  type        = string
  default     = ""
}

variable "primary_vpc_cidr" {
  description = "CIDR block of the primary region VPC"
  type        = string
  default     = ""
}

variable "secondary_vpc_id" {
  description = "VPC ID in the secondary region"
  type        = string
  default     = ""
}

variable "secondary_vpc_cidr" {
  description = "CIDR block of the secondary region VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "secondary_subnet_ids" {
  description = "Subnet IDs in the secondary region for Aurora and Lambda"
  type        = list(string)
  default     = []
}

# ── API Gateway / Route53 ─────────────────────────────────────────────────────────

variable "primary_api_fqdn" {
  description = "FQDN of the primary region API Gateway custom domain endpoint"
  type        = string
  default     = ""
}

variable "secondary_api_fqdn" {
  description = "FQDN of the secondary region API Gateway"
  type        = string
  default     = ""
}

variable "secondary_health_api_fqdn" {
  description = "FQDN of the secondary region /health APIGWv2 endpoint (without https:// or path). Used to serve api.securebase.tximhotep.com/health via CloudFront without adding routes to the primary REST API. Retrieve after first apply: aws apigatewayv2 get-apis --region us-west-2 --query \"Items[?contains(Name,'health-secondary')].ApiEndpoint\" --output text | sed 's|https://||'"
  type        = string
  default     = ""
}

variable "primary_api_endpoint" {
  description = "Primary API Gateway invoke URL for Route53 health check"
  type        = string
  default     = ""
}

variable "secondary_api_endpoint" {
  description = "Secondary API Gateway invoke URL for Route53 failover"
  type        = string
  default     = ""
}

variable "secondary_api_gateway_id" {
  description = "Secondary region API Gateway REST API ID"
  type        = string
  default     = ""
}

variable "api_dns_name" {
  description = "DNS record name for the API endpoint"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = ""
}

variable "route53_hosted_zone_id" {
  description = "Alias for hosted_zone_id"
  type        = string
  default     = ""
}

# ── CloudFront ─────────────────────────────────────────────────────────────────────

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

# ── Alerting ────────────────────────────────────────────────────────────────────────

variable "alert_sns_arn" {
  description = "SNS topic ARN for DR alerts"
  type        = string
  default     = ""
}

# ── Tags ──────────────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
