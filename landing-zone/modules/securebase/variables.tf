# Inside modules/securebase/variables.tf

variable "netlify_api_token" {
  description = "API token for Netlify"
  type        = string
  sensitive   = true
}

variable "lambda_packages" {
  description = "Map of ZIP file paths for Lambdas"
  type        = map(string)
}
# Inside modules/securebase/variables.tf

variable "stripe_public_key" {
  description = "Stripe Live Public Key (pk_live_...)"
  type        = string
}

# Ensure these match the variables you are passing in your root main.tf
variable "environment" {
  type = string
}

variable "target_region" {
  type = string
}
