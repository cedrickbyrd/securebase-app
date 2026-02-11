variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for SES"
  type        = string
  default     = "us-east-1"
}

variable "sender_email" {
  description = "Default sender email address"
  type        = string
  default     = "noreply@tximhotep.com"
}
