variable "root_resource_id" {
  description = "ID of the root (/) resource in the existing API Gateway."
  type        = string
}
variable "signup_lambda_arn" {
  description = "ARN of the signup_handler Lambda function."
  type        = string
}
variable "signup_lambda_name" {
  description = "Name of the signup_handler Lambda function."
  type        = string
  default     = "securebase-signup-handler"
}
variable "verify_email_lambda_arn" {
  description = "ARN of the verify_email Lambda function."
  type        = string
}
variable "verify_email_lambda_name" {
  description = "Name of the verify_email Lambda function."
  type        = string
  default     = "securebase-verify-email"
}
variable "onboarding_lambda_arn" {
  description = "ARN of the onboarding_status Lambda function."
  type        = string
}
variable "onboarding_lambda_name" {
  description = "Name of the onboarding_status Lambda function."
  type        = string
  default     = "securebase-onboarding-status"
}