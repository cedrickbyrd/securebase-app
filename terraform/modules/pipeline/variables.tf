variable "environment" {
  description = "Terraform workspace/environment (dev, staging, prod)"
  type        = string
}

variable "backend_bucket" {
  description = "S3 bucket for terraform remote state"
  type        = string
}

variable "lock_table" {
  description = "DynamoDB table for terraform state locks"
  type        = string
}
