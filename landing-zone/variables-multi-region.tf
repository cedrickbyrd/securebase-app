# Phase 5.4 multi-region variables — added to root module
# These are passed through to module.multi_region

variable "aurora_cluster_id" {
  description = "Existing Aurora cluster ID to attach to the global cluster"
  type        = string
  default     = ""
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.15"
}

variable "aurora_instance_class" {
  description = "Aurora instance class for secondary region"
  type        = string
  default     = "db.r6g.large"
}

variable "dynamodb_table_names" {
  description = "DynamoDB table names to replicate to secondary region"
  type        = list(string)
  default     = []
}

variable "primary_vpc_id" {
  description = "Primary VPC ID"
  type        = string
  default     = ""
}

variable "primary_vpc_cidr" {
  description = "Primary VPC CIDR block"
  type        = string
  default     = ""
}

variable "secondary_vpc_id" {
  description = "Secondary VPC ID in us-west-2"
  type        = string
  default     = ""
}

variable "secondary_vpc_cidr" {
  description = "Secondary VPC CIDR block"
  type        = string
  default     = ""
}

variable "secondary_subnet_ids" {
  description = "Secondary subnet IDs in us-west-2"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "primary_api_fqdn" {
  description = "Primary API Gateway FQDN for CloudFront origin"
  type        = string
  default     = ""
}

variable "secondary_api_fqdn" {
  description = "Secondary API Gateway FQDN for CloudFront failover origin"
  type        = string
  default     = ""
}

variable "cloudfront_aliases" {
  description = "CloudFront distribution aliases"
  type        = list(string)
  default     = []
}

variable "audit_log_bucket_name" {
  description = "S3 bucket name for audit log CRR source"
  type        = string
  default     = ""
}
