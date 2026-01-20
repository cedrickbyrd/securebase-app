# Lambda Functions Module Outputs

output "auth_v2_arn" {
  description = "ARN of auth_v2 Lambda function"
  value       = aws_lambda_function.auth_v2.arn
}

output "auth_v2_name" {
  description = "Name of auth_v2 Lambda function"
  value       = aws_lambda_function.auth_v2.function_name
}

output "webhook_manager_arn" {
  description = "ARN of webhook_manager Lambda function"
  value       = aws_lambda_function.webhook_manager.arn
}

output "webhook_manager_name" {
  description = "Name of webhook_manager Lambda function"
  value       = aws_lambda_function.webhook_manager.function_name
}

output "billing_worker_arn" {
  description = "ARN of billing_worker Lambda function"
  value       = aws_lambda_function.billing_worker.arn
}

output "billing_worker_name" {
  description = "Name of billing_worker Lambda function"
  value       = aws_lambda_function.billing_worker.function_name
}

output "support_tickets_arn" {
  description = "ARN of support_tickets Lambda function"
  value       = aws_lambda_function.support_tickets.arn
}

output "support_tickets_name" {
  description = "Name of support_tickets Lambda function"
  value       = aws_lambda_function.support_tickets.function_name
}

output "cost_forecasting_arn" {
  description = "ARN of cost_forecasting Lambda function"
  value       = aws_lambda_function.cost_forecasting.arn
}

output "cost_forecasting_name" {
  description = "Name of cost_forecasting Lambda function"
  value       = aws_lambda_function.cost_forecasting.function_name
}

output "lambda_role_arn" {
  description = "ARN of Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "all_lambda_arns" {
  description = "Map of all Lambda function ARNs"
  value = {
    auth_v2          = aws_lambda_function.auth_v2.arn
    webhook_manager  = aws_lambda_function.webhook_manager.arn
    billing_worker   = aws_lambda_function.billing_worker.arn
    support_tickets  = aws_lambda_function.support_tickets.arn
    cost_forecasting = aws_lambda_function.cost_forecasting.arn
  }
}
