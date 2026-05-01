variable "environment" {
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
