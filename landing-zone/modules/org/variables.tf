variable "org_root_id" {
  description = "The ID of the AWS Organization Root"
  type        = string
}

#variable "org_name" {
#  description = "The name of the AWS Organization"
#  type        = string
#}
variable "org_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.org_name))
    error_message = "Organization name must be DNS-compliant (lowercase letters, numbers, hyphens)."
  }
}

#variable "org_name" {
#  description = "TxImhotep"
#  type        = string
#  
#  validation {
#    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.org_name))
#    error_message = "Organization name must be 3-63 characters, lowercase alphanumeric and hyphens only."
#  }
#}
