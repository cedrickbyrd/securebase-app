variable "management_account_id" {
  description = "Management account ID for break-glass role"
  type        = string
}

variable "sso_instance_arn" {
  type        = string
  description = "The ARN of the SSO instance for permission sets"
}

variable "accounts" {
  type        = map(string)
  description = "Map of AWS accounts"
}

variable "allowed_regions" {
  type        = list(string)
  description = "List of permitted regions"
}
