variable "pilot_availability_lambda_name" {
  description = "Name of the pilot availability Lambda function."
  type        = string
  default     = "securebase-pilot-availability"
}

variable "validate_session_lambda_name" {
  description = "Name of the validate session Lambda function."
  type        = string
  default     = "securebase-validate-session"
}

variable "stripe_webhook_lambda_name" {
  description = "Name of the Stripe webhook Lambda function."
  type        = string
  default     = "securebase-stripe-webhook"
}
