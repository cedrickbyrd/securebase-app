variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "enable_inbound_email" {
  description = "Enable MX record for inbound email (WARNING: This will override existing MX records)"
  type        = bool
  default     = false
}

variable "existing_apex_txt_records" {
  description = "Existing TXT records at domain apex (to merge with SPF record)"
  type        = list(string)
  default     = []
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
