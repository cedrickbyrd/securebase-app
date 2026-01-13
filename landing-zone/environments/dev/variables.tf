variable "organization_name" {
  description = "Name of the AWS Organization"
  type        = string
}

variable "accounts" {
  description = "Map of accounts to create"
  type = map(object({
    email = string
    ou_id = string
  }))
}

variable "allowed_regions" {
  description = "List of allowed AWS regions"
  type        = list(string)
}

variable "management_account_id" {
  description = "Management account ID"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
}

