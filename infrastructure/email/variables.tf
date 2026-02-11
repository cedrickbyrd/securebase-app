variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "sender_email" {
  description = "Default sender email address"
  type        = string
  default     = "noreply@tximhotep.com"
}

variable "create_mx_record" {
  description = "Create MX record for inbound email (WARNING: Will override existing MX records)"
  type        = bool
  default     = false
}

variable "create_spf_record" {
  description = "Create SPF TXT record (WARNING: Will override existing TXT records at apex)"
  type        = bool
  default     = true
}
