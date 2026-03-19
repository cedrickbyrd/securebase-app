# ../../modules/securebase/outputs.tf

output "stripe_handler_function_name" {
  description = "Name of the Stripe handler Lambda function."
  value       = aws_lambda_function.stripe_handler.function_name
}

output "stripe_handler_function_arn" {
  description = "ARN of the Stripe handler Lambda function."
  value       = aws_lambda_function.stripe_handler.arn
}
