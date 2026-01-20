variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "reporting_layer_arn" {
  description = "ARN of Lambda layer containing ReportLab and openpyxl"
  type        = string
  default     = null
}
