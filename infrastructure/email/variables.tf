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
