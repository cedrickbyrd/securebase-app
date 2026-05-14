variable "checkout_lambda_arn" {
  description = "ARN of the create-checkout-session Lambda function."
  type        = string
}

variable "checkout_lambda_name" {
  description = "Name of the create-checkout-session Lambda function."
  type        = string
  default     = "securebase-create-checkout-session"
}
