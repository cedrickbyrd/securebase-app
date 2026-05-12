variable "tenant_id" {
  description = "Unique tenant identifier"
  type        = string
}

variable "tenant_name" {
  description = "Human readable tenant name"
  type        = string
}

variable "tier" {
  description = "Tenant tier"
  type        = string
  default     = "standard"
}

variable "framework" {
  description = "Primary compliance framework"
  type        = string
  default     = "cis"
}

variable "region" {
  description = "Deployment region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
