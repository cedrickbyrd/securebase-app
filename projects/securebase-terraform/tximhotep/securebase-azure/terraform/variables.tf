variable "resource_group_name" {
  type        = string
  description = "Name of the Azure Resource Group"
  default     = "rg-securebase-azure-dev"
}

variable "location" {
  type        = string
  description = "Azure Region for SecureBase resources"
  default     = "eastus"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "immutability_period_days" {
  type        = number
  description = "WORM retention period in days (7 years = 2555 days)"
  default     = 2555
}
