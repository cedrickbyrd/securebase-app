variable "sso_instance_arn" {
  description = "ARN of the AWS SSO instance"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
