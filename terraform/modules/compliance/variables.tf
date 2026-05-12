variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "securebase"
}

variable "evidence_bucket_name" {
  description = "S3 bucket name for immutable evidence storage"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    ManagedBy           = "terraform"
    ComplianceFramework = "SOC2,HIPAA,FedRAMP"
  }
}
