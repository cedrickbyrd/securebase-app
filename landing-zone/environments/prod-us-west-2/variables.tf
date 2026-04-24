variable "environment" {
<<<<<<< HEAD
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default = {
    Project             = "SecureBase"
    ManagedBy           = "Terraform"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "sensitive"
  }
}

variable "primary_api_fqdn" {
  description = "Primary region API FQDN (us-east-1)"
  type        = string
}

variable "secondary_api_fqdn" {
  description = "Secondary region API FQDN (us-west-2)"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  type        = string
}

variable "secondary_vpc_id" {
  description = "VPC ID in us-west-2"
  type        = string
}

variable "secondary_vpc_cidr" {
  description = "CIDR block of the us-west-2 VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "secondary_subnet_ids" {
  description = "Subnet IDs in us-west-2 for Aurora and Lambda"
  type        = list(string)
  default     = []
}

variable "cloudfront_aliases" {
  description = "Custom domain aliases for CloudFront"
  type        = list(string)
  default     = ["api.securebase.tximhotep.com"]
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront"
  type        = string
  default     = ""
}
=======
  type    = string
  default = "prod"
}

variable "primary_region" {
  type    = string
  default = "us-east-1"
}

variable "secondary_region" {
  type    = string
  default = "us-west-2"
}

variable "aurora_cluster_id" {
  description = "Primary Aurora cluster ID (in us-east-1)"
  type        = string
  default     = "securebase-prod-cluster"
}

variable "aurora_engine_version" {
  type    = string
  default = "8.0.mysql_aurora.3.04.0"
}

variable "dynamodb_table_names" {
  description = "Tables to replicate to us-west-2"
  type        = list(string)
  default = [
    "securebase-users",
    "securebase-cache-prod",
    "securebase-prod-notifications",
    "securebase-prod-support-tickets",
    "securebase-prod-reports",
    "securebase-prod-metrics",
  ]
}

variable "route53_hosted_zone_id" {
  type    = string
  default = ""
}

variable "primary_api_endpoint" {
  description = "Primary (us-east-1) API GW FQDN"
  type        = string
  default     = "9xyetu7zq3.execute-api.us-east-1.amazonaws.com"
}

variable "secondary_api_endpoint" {
  description = "Secondary (us-west-2) API GW FQDN — set after deploying API GW in secondary region"
  type        = string
  default     = ""
}

variable "alert_sns_arn" {
  description = "SNS topic ARN from phase5-alerting (prod)"
  type        = string
  default     = ""
}

variable "tags" {
  type = map(string)
  default = {
    Project             = "SecureBase"
    ManagedBy           = "Terraform"
    Environment         = "prod"
    ComplianceFramework = "SOC2,FedRAMP,HIPAA"
    DataClassification  = "sensitive"
  }
}
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
